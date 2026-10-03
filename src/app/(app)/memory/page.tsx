"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { MemoryTab } from "@/components/memory/MemoryTab"
import { toast, undoToast } from "@/components/ui/toast"
import type { Entry } from "@/lib/entries"
import type { CleanupFlag } from "@/lib/core"
import type { MergeInput } from "@/components/memory/MergeDialog"

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
  const cleanup = params.get("cleanup") === "1"
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [flags, setFlags] = useState<CleanupFlag[] | null>(null)

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

  // Health flags (incl. dismissed) for the Cleanup count + panel; they depend on the board and roadmap too
  const loadFlags = useCallback(() => {
    fetch(`/api/memory/health${rootParam}&dismissed=1`)
      .then((r) => r.json())
      .then((d: { flags?: CleanupFlag[] }) => setFlags(d.flags ?? []))
      .catch((e) => {
        console.warn("Loading memory health failed", e)
        setFlags([])
      })
  }, [rootParam])
  useEffect(() => {
    loadFlags()
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type ?? ""
      if (type === "memory_updated" || type === "roadmap_updated" || type.startsWith("task_")) loadFlags()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [loadFlags])

  const dismiss = useCallback(async (flag: CleanupFlag) => {
    const today = new Date().toLocaleDateString("en-CA")
    setFlags((list) => (list ?? []).map((f) => (f.id === flag.id ? { ...f, dismissed: today } : f)))
    try {
      const res = await fetch(`/api/memory/health/dismiss${rootParam}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: flag.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
    } catch (e) {
      toast(`Dismiss failed: ${e instanceof Error ? e.message : String(e)}`)
      loadFlags()
    }
  }, [rootParam, loadFlags])

  const go = useCallback((entry: string | null, v: "list" | "graph", withCleanup = false) => {
    const q = new URLSearchParams()
    if (v === "graph") q.set("view", "graph")
    if (entry) q.set("entry", entry)
    if (withCleanup) q.set("cleanup", "1")
    router.replace(q.size ? `/memory?${q}` : "/memory", { scroll: false })
  }, [router])
  const select = useCallback((id: string | null) => {
    setCreating(false)
    go(id, view)
  }, [go, view])

  const post = useCallback(async (url: string, body: object) => {
    const res = await fetch(`${url}${rootParam}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
    return data
  }, [rootParam])

  // No confirm: delete now, offer Undo (restores the same file), like tasks and docs
  const remove = useCallback(async (entry: Entry) => {
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
  }, [post, select, load])

  // The dialog is the approval; Undo writes every touched file back
  const merge = useCallback(async (input: MergeInput): Promise<string | null> => {
    try {
      const { entry, before } = await post("/api/memory/entries/merge", input)
      setEntries((list) => [...(list ?? []).filter((e) => e.id !== entry.id && !input.dropIds.includes(e.id)), entry])
      select(entry.id)
      undoToast(`Merged into ${entry.id}`, async () => {
        await post("/api/memory/entries/merge/undo", { before })
        load()
        select(entry.id)
      })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }, [post, select, load])

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
      onView={(v) => go(selectedId, v, cleanup)}
      flags={flags}
      cleanup={cleanup && !creating && !selectedId}
      onCleanup={(open) => { setCreating(false); go(open ? null : selectedId, view, open) }}
      onDismiss={dismiss}
      onMerge={merge}
      onSaved={(entry) => {
        // show the saved text now; the SSE refetch confirms it
        setEntries((list) => [...(list ?? []).filter((e) => e.id !== entry.id), entry])
        select(entry.id)
      }}
    />
  )
}
