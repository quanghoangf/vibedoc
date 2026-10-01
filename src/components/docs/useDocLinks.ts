"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useApp } from "@/context/AppContext"
import type { LinkRow, TargetRow } from "@/lib/doc-links"

export type DocLinksData = { out: LinkRow[]; in: LinkRow[]; broken: LinkRow[]; stale: LinkRow[]; targets: Record<string, TargetRow> }

/** Events that can change which files exist or what they link to. */
export const LINK_EVENTS = new Set(["doc_updated", "doc_created", "doc_deleted", "doc_renamed", "task_created", "task_updated", "roadmap_updated", "memory_updated", "decision_logged"])

// A burst of LINK_EVENTS (an agent moving five tasks) becomes one generation bump, so one refetch per URL
const DEBOUNCE_MS = 250
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
const subscribers = new Set<() => void>()
function onSse(e: Event) {
  if (!LINK_EVENTS.has((e as CustomEvent<{ type: string }>).detail?.type)) return
  clearTimeout(timer)
  timer = setTimeout(() => {
    generation++
    cache.clear()
    subscribers.forEach((f) => f())
  }, DEBOUNCE_MS)
}
function subscribe(cb: () => void) {
  if (!subscribers.size) window.addEventListener("vibedoc:sse", onSse)
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
    if (subscribers.size) return
    window.removeEventListener("vibedoc:sse", onSse)
    clearTimeout(timer)
  }
}

/** Bumps ~250ms after the last file-changing SSE event; use it as an effect dep to refetch link data. */
export function useLinkGeneration(): number {
  return useSyncExternalStore(subscribe, () => generation, () => 0)
}

// One request per URL per generation, shared by every caller (DocViewer + the preview's link handling, strict
// mode's double effect). A failure is evicted so Retry asks again.
const cache = new Map<string, Promise<unknown>>()
export function fetchLinkJson<T>(url: string): Promise<T> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then(async (r) => {
      const body = await r.json().catch(() => null)
      if (!r.ok) throw new Error(body?.error ?? `${r.status} ${r.statusText}`)
      return body
    })
    const mine = p
    mine.catch(() => { if (cache.get(url) === mine) cache.delete(url) })
    cache.set(url, mine)
  }
  return p as Promise<T>
}

/**
 * Resolved links of one .md file (R056), from GET /api/docs/links; null while loading, empty for an unknown file.
 * Refetched on file-changing SSE events. The browser never resolves paths: a clicked link is matched to this data
 * by its raw target string as written in the file (`../b/y.md` without `#h`, `[[DOMAIN_MAP]]` → `DOMAIN_MAP`),
 * looked up in `targets` first, then `broken`.
 */
export function useDocLinks(path: string | undefined): DocLinksData | null {
  const { rootParam } = useApp()
  const [data, setData] = useState<{ path: string; links: DocLinksData } | null>(null)
  const gen = useLinkGeneration()

  useEffect(() => {
    if (!path) return
    let live = true
    fetchLinkJson<Partial<DocLinksData>>(`/api/docs/links${rootParam}&path=${encodeURIComponent(path)}`)
      .then((d) => {
        if (live) setData({ path, links: { out: d.out ?? [], in: d.in ?? [], broken: d.broken ?? [], stale: d.stale ?? [], targets: d.targets ?? {} } })
      })
      .catch((e) => {
        console.warn("Loading doc links failed", e)
        if (live) setData({ path, links: { out: [], in: [], broken: [], stale: [], targets: {} } })
      })
    return () => { live = false }
  }, [path, rootParam, gen])

  // another file's links never show while this one loads
  return path && data?.path === path ? data.links : null
}
