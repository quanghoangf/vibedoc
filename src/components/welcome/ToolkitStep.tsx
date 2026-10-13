"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { ToolkitPicker, type ToolkitEntry, type ToolkitResult } from "@/components/toolkit/ToolkitPicker"
import { ToolkitConfirmDialog } from "@/components/toolkit/ToolkitConfirmDialog"

/** A plugin installed inside Claude Code never calls VibeDoc: re-check this often while something is left (as R081's skills step). */
const POLL_MS = 10_000

/** R098: "Pick your toolkit" on the welcome, after the agent row. Install runs only after the confirm dialog. */
export function ToolkitStep() {
  const { rootParam } = useApp()
  const { t } = useT()
  const [items, setItems] = useState<ToolkitEntry[] | null>(null)
  const [cli, setCli] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Map<string, ToolkitResult>>(new Map())
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/toolkit${rootParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (signal?.cancelled) return
        setItems(Array.isArray(d?.items) ? d.items : [])
        setCli(d?.cli?.available ?? false)
        setFailed(false)
      })
      .catch((e) => {
        console.warn("[vibedoc] could not load the toolkit:", e)
        if (!signal?.cancelled) setFailed(true)
      })
  }, [rootParam])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    const onSse = (e: Event) => { if ((e as CustomEvent).detail?.type === "toolkit") load(signal) }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load])

  const allInstalled = items !== null && items.length > 0 && items.every((i) => i.installed)
  useEffect(() => {
    if (allInstalled || !cli) return
    const signal = { cancelled: false }
    const check = () => load(signal)
    const timer = setInterval(check, POLL_MS)
    window.addEventListener("focus", check)
    return () => { signal.cancelled = true; clearInterval(timer); window.removeEventListener("focus", check) }
  }, [load, allInstalled, cli])

  const picked = (items ?? []).filter((i) => selected.has(i.id) && !i.installed)

  const install = async () => {
    setConfirm(false)
    setRunning(true)
    const ids = picked.map((i) => i.id)
    try {
      const res = await fetch(`/api/toolkit${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const d = await res.json().catch(() => null)
      const list: ToolkitResult[] = Array.isArray(d?.results)
        ? d.results
        : ids.map((id) => ({ id, ok: false, stderr: d?.error ?? `HTTP ${res.status}` }))
      setResults(new Map(list.map((r) => [r.id, r])))
    } catch (e) {
      setResults(new Map(ids.map((id) => [id, { id, ok: false, stderr: (e as Error).message }])))
    }
    setSelected(new Set())
    setRunning(false)
    load()
  }

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <section className="w-full space-y-3 rounded-lg border border-border p-4 text-left" aria-labelledby="toolkit-title">
      <div>
        <h2 id="toolkit-title" className="text-sm font-semibold text-txt">{t("welcome.toolkitTitle")}</h2>
        <p className="text-xs text-muted">{t("welcome.toolkitHint")}</p>
      </div>
      {failed ? (
        <p className="text-xs text-amber-400" role="alert">{t("welcome.toolkitLoadFailed")}</p>
      ) : items === null ? (
        <p className="text-xs text-muted" aria-busy="true">{t("welcome.toolkitLoading")}</p>
      ) : (
        <>
          {!cli && <p className="text-xs text-muted">{t("welcome.toolkitNoCli")}</p>}
          <ToolkitPicker items={items} selected={selected} onToggle={toggle} results={results} cli={cli} disabled={running} />
          {allInstalled ? (
            <p className="text-xs text-teal" role="status">{t("welcome.toolkitAllInstalled")}</p>
          ) : cli && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              disabled={running || picked.length === 0}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
            >
              {running && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              {t(running ? "welcome.toolkitInstalling" : "welcome.toolkitInstall")}
            </button>
          )}
        </>
      )}
      {confirm && <ToolkitConfirmDialog items={picked} onConfirm={install} onClose={() => setConfirm(false)} />}
    </section>
  )
}
