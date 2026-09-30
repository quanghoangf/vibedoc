"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { MemoryTab } from "@/components/memory/MemoryTab"
import { toast, undoToast } from "@/components/ui/toast"
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
  // ?entry=E012 is the open entry and ?view=graph the Graph view, so a link or a reload keeps both
  const params = useSearchParams()
  const selectedId = params.get("entry")
  const view = params.get("view") === "graph" ? "graph" : "list"
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

  const go = useCallback((entry: string | null, v: "list" | "graph") => {
    const q = new URLSearchParams()
    if (v === "graph") q.set("view", "graph")
    if (entry) q.set("entry", entry)
    router.replace(q.size ? `/memory?${q}` : "/memory", { scroll: false })
  }, [router])
  const select = useCallback((id: string | null) => {
    setCreating(false)
    go(id, view)
  }, [go, view])

  // No confirm: delete now, offer Undo (restores the same file), like tasks and docs
  const remove = useCallback(async (entry: Entry) => {
    const post = async (url: string, body: object) => {
      const res = await fetch(`${url}${rootParam}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
      return data
    }
    try {
      const { file, raw } = await post("/api/memory/entries/delete", { id: entry.id })
      setEntries((list) => (list ?? []).filter((e) => e.id !== entry.id))
      select(null)
      undoToast(`Deleted ${entry.id}`, async () => {
        await post("/api/memory/entries/restore", { file, raw })
        load()
        select(entry.id)
      })
    } catch (e) {
      toast(`Delete failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [rootParam, select, load])

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
      onDelete={remove}
      view={view}
      onView={(v) => go(selectedId, v)}
      onSaved={(entry) => {
        // show the saved text now; the SSE refetch confirms it
        setEntries((list) => [...(list ?? []).filter((e) => e.id !== entry.id), entry])
        select(entry.id)
      }}
    />
  )
}
