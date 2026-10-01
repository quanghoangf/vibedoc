"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/context/AppContext"
import type { LinkRow, TargetRow } from "@/lib/doc-links"

export type DocLinksData = { out: LinkRow[]; in: LinkRow[]; broken: LinkRow[]; targets: Record<string, TargetRow> }

/** Events that can change which files exist or what they link to. */
const LINK_EVENTS = new Set(["doc_updated", "doc_created", "doc_deleted", "doc_renamed", "task_created", "task_updated", "roadmap_updated", "memory_updated", "decision_logged"])

/**
 * Resolved links of one .md file (R056), from GET /api/docs/links; null while loading, empty for an unknown file.
 * Refetched on file-changing SSE events. The browser never resolves paths: a clicked link is matched to this data
 * by its raw target string as written in the file (`../b/y.md` without `#h`, `[[DOMAIN_MAP]]` → `DOMAIN_MAP`),
 * looked up in `targets` first, then `broken`.
 */
export function useDocLinks(path: string | undefined): DocLinksData | null {
  const { rootParam } = useApp()
  const [data, setData] = useState<{ path: string; links: DocLinksData } | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onSse = (e: Event) => {
      if (LINK_EVENTS.has((e as CustomEvent<{ type: string }>).detail?.type)) setTick((t) => t + 1)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [])

  useEffect(() => {
    if (!path) return
    let live = true
    fetch(`/api/docs/links${rootParam}&path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d: Partial<DocLinksData>) => {
        if (live) setData({ path, links: { out: d.out ?? [], in: d.in ?? [], broken: d.broken ?? [], targets: d.targets ?? {} } })
      })
      .catch((e) => {
        console.warn("Loading doc links failed", e)
        if (live) setData({ path, links: { out: [], in: [], broken: [], targets: {} } })
      })
    return () => { live = false }
  }, [path, rootParam, tick])

  // another file's links never show while this one loads
  return path && data?.path === path ? data.links : null
}
