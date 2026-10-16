"use client"

import { useCallback, useEffect, useState } from "react"
import type { InboxItem } from "@/lib/inbox"

async function fetchInbox(query: string): Promise<InboxItem[]> {
  const res = await fetch(`/api/inbox${query}`)
  const data = await res.json().catch(() => null)
  if (!res.ok || !Array.isArray(data)) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

/**
 * GET /api/inbox (R105) for the header badge and /inbox, refetched on every SSE event (the bus is process-wide, so a
 * chat waiting in another project arrives too), at most once per 300ms because test runs stream events.
 * `query` = the server filters (`?project=` / `?group=`); null items while the first load runs.
 */
export function useInbox(query = "") {
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loaded = useCallback((data: InboxItem[]) => { setItems(data); setError(null) }, [])
  const failed = useCallback((e: Error) => { console.warn("[vibedoc] inbox:", e); setError(e.message) }, [])
  const reload = useCallback(() => fetchInbox(query).then(loaded, failed), [query, loaded, failed])

  useEffect(() => {
    fetchInbox(query).then(loaded, failed)
    let timer: ReturnType<typeof setTimeout> | null = null
    const onSse = () => {
      if (timer) return
      timer = setTimeout(() => { timer = null; fetchInbox(query).then(loaded, failed) }, 300)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => {
      window.removeEventListener("vibedoc:sse", onSse)
      if (timer) clearTimeout(timer)
    }
  }, [query, loaded, failed])

  return { items, error, reload, setItems }
}
