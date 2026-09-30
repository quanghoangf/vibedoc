"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { MemoryTab } from "@/components/memory/MemoryTab"
import type { Entry } from "@/lib/entries"

export default function MemoryPage() {
  return (
    <Suspense>
      <MemoryPageInner />
    </Suspense>
  )
}

function MemoryPageInner() {
  const { summary, rootParam } = useApp()
  const router = useRouter()
  // ?entry=E012 is the open entry, so a link or a reload opens it
  const selectedId = useSearchParams().get("entry")
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    let live = true
    fetch(`/api/memory/entries${rootParam}`)
      .then((r) => r.json())
      .then((d: { entries?: Entry[] }) => { if (live) setEntries(d.entries ?? []) })
      .catch((e) => {
        console.warn("Loading memory entries failed", e)
        if (live) setEntries([])
      })
    return () => { live = false }
  }, [rootParam])

  // AppContext replaces `summary` on every memory_updated SSE event, so refetch the entries with it
  useEffect(() => load(), [load, summary])

  const select = (id: string | null) => {
    setCreating(false)
    router.replace(id ? `/memory?entry=${encodeURIComponent(id)}` : "/memory", { scroll: false })
  }

  return (
    <MemoryTab
      memory={summary?.memory ?? null}
      entries={entries}
      rootParam={rootParam}
      selectedId={creating ? null : selectedId}
      creating={creating}
      onOpen={select}
      onNew={() => setCreating(true)}
      onClose={() => select(null)}
      onSaved={(entry) => {
        // show the saved text now; the SSE refetch confirms it
        setEntries((list) => [...(list ?? []).filter((e) => e.id !== entry.id), entry])
        select(entry.id)
      }}
    />
  )
}
