"use client"

import { useCallback, useEffect, useState } from "react"
import { useApp } from "@/context/AppContext"
import type { ToolkitEntry, ToolkitResult } from "./ToolkitPicker"

/** A plugin installed inside Claude Code never calls VibeDoc: re-check this often while something is left (as R081's skills step). */
const POLL_MS = 10_000

/**
 * R098: GET /api/toolkit (live: SSE `toolkit`, focus, every POLL_MS while something is left) and the confirmed
 * POST. Shared by the welcome step and the chat card. `install` resolves with the per-item results.
 * `initial`: ids to tick (the agent's preselect), or "fits" = every matched plugin not installed yet, once the list loads.
 */
export function useToolkit(initial: string[] | "fits" = []) {
  const { rootParam } = useApp()
  const [items, setItems] = useState<ToolkitEntry[] | null>(null)
  const [cli, setCli] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial === "fits" ? [] : initial))
  const [results, setResults] = useState<Map<string, ToolkitResult>>(new Map())
  const [installing, setInstalling] = useState<Set<string>>(new Set())
  const [preselected, setPreselected] = useState(initial !== "fits")

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/toolkit${rootParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (signal?.cancelled) return
        const list: ToolkitEntry[] = Array.isArray(d?.items) ? d.items : []
        setItems(list)
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

  // "fits": tick the recommended set once, on the first list (later polls never re-tick what the user unticked)
  if (!preselected && items !== null) {
    setPreselected(true)
    setSelected(new Set(items.filter((i) => i.matched && !i.installed).map((i) => i.id)))
  }

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

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  async function install(): Promise<ToolkitResult[]> {
    const ids = picked.map((i) => i.id)
    setInstalling(new Set(ids))
    let list: ToolkitResult[]
    try {
      const res = await fetch(`/api/toolkit${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const d = await res.json().catch(() => null)
      list = Array.isArray(d?.results) ? d.results : ids.map((id) => ({ id, ok: false, stderr: d?.error ?? `HTTP ${res.status}` }))
    } catch (e) {
      list = ids.map((id) => ({ id, ok: false, stderr: (e as Error).message }))
    }
    setResults(new Map(list.map((r) => [r.id, r])))
    setSelected(new Set())
    setInstalling(new Set())
    load()
    return list
  }

  const running = installing.size > 0
  return { items, cli, failed, selected, toggle, results, installing, running, picked, allInstalled, install }
}
