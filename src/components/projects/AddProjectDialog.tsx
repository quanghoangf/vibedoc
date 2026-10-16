"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import { MAX_SCAN_RESULTS, type HubProject, type ScannedRepo } from "@/lib/hub"

export type AddMode = "path" | "scan"
export type AddedProject = HubProject & { added: boolean }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as T
}

const addRoots = (roots: string[]) =>
  call<{ projects: AddedProject[] }>("/api/projects/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roots }) })

const field = "h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-xs text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"

/** All projects → Add project (R101 T536): one folder by its path, or scan a folder and tick the repos to add. */
export function AddProjectDialog({ mode, onClose, onAdded }: { mode: AddMode; onClose: () => void; onAdded: (projects: AddedProject[]) => void }) {
  const { t, tn } = useT()
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repos, setRepos] = useState<ScannedRepo[] | null>(null)
  const [scannedDir, setScannedDir] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const addPath = () => run(async () => {
    const { projects } = await addRoots([input])
    onAdded(projects)
  })

  const scan = () => run(async () => {
    setRepos(null)
    setPicked(new Set())
    const res = await call<{ repos: ScannedRepo[] }>(`/api/projects/scan?dir=${encodeURIComponent(input)}`)
    setRepos(res.repos)
    setScannedDir(input.trim())
  })

  const addPicked = () => run(async () => {
    const { projects } = await addRoots([...picked])
    onAdded(projects)
  })

  const fresh = repos?.filter((r) => !r.inHub) ?? []
  const toggle = (root: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(root)) next.delete(root)
    else next.add(root)
    return next
  })

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border bg-surface text-txt shadow-xl shadow-black/20">
        <DialogTitle className="text-sm font-semibold text-txt">{mode === "path" ? t("projects.addPathTitle") : t("projects.scanTitle")}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{mode === "path" ? t("projects.addPathLead") : t("projects.scanLead")}</DialogDescription>

        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) (mode === "path" ? addPath : scan)() }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "path" ? t("projects.pathPlaceholder") : t("projects.scanPlaceholder")}
            aria-label={mode === "path" ? t("projects.pathLabel") : t("projects.scanLabel")}
            aria-invalid={!!error || undefined}
            className={field}
          />
          <Button type="submit" size="sm" variant={mode === "path" ? "default" : "secondary"} className="h-9" disabled={busy || !input.trim()}>
            {mode === "path" ? t("projects.addOne") : busy && !repos ? t("projects.scanning") : t("projects.scan")}
          </Button>
        </form>
        {error && <p role="alert" className="text-xs text-danger">{t("projects.addFailed", { error })}</p>}

        {mode === "scan" && repos && (
          repos.length === 0 ? (
            <p className="text-sm text-muted">{t("projects.scanNone", { dir: scannedDir })}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{tn("projects.scanFound", repos.length, { fresh: fresh.length })}</span>
                {repos.length >= MAX_SCAN_RESULTS && <span>{t("projects.scanCapped", { n: MAX_SCAN_RESULTS })}</span>}
                {fresh.length > 0 && (
                  <button type="button" className="ml-auto text-accent hover:underline" onClick={() => setPicked(new Set(fresh.map((r) => r.root)))}>
                    {t("projects.selectAll")}
                  </button>
                )}
              </div>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border" data-scan-results>
                {repos.map((r) => (
                  <li key={r.root}>
                    <label className={cn("flex items-center gap-3 px-3 py-2 text-sm", r.inHub ? "text-muted" : "cursor-pointer hover:bg-surface2")}>
                      <input
                        type="checkbox"
                        className="size-3.5 accent-accent"
                        disabled={r.inHub}
                        checked={!r.inHub && picked.has(r.root)}
                        onChange={() => toggle(r.root)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" data-user-content>{r.name}</span>
                        <span className="block truncate font-mono text-[11px] text-muted" title={r.root} data-user-content>{r.root}</span>
                      </span>
                      {r.inHub && <span className="rounded-sm bg-surface2 px-1.5 py-0.5 text-[11px]">{t("projects.inHub")}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onClose}>{t("projects.cancel")}</Button>
                <Button type="button" size="sm" disabled={busy || picked.size === 0} onClick={addPicked}>
                  {tn("projects.addSelected", picked.size)}
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
