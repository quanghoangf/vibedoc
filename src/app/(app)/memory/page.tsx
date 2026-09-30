"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/context/AppContext"
import { MemoryTab } from "@/components/memory/MemoryTab"
import type { Entry } from "@/lib/entries"

export default function MemoryPage() {
  const { summary, rootParam } = useApp()
  const [entries, setEntries] = useState<Entry[] | null>(null)

  // AppContext replaces `summary` on every memory_updated SSE event, so refetch the entries with it
  useEffect(() => {
    let live = true
    fetch(`/api/memory/entries${rootParam}`)
      .then((r) => r.json())
      .then((d: { entries?: Entry[] }) => { if (live) setEntries(d.entries ?? []) })
      .catch((e) => {
        console.warn("Loading memory entries failed", e)
        if (live) setEntries([])
      })
    return () => { live = false }
  }, [summary, rootParam])

  return <MemoryTab memory={summary?.memory ?? null} entries={entries} />
}
