"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, FileText, Flag, Lightbulb, ListChecks, Scale } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { displayStatus } from "@/lib/statuses"
import type { GraphNode, MemoryGraph, NodeKind } from "@/lib/memory-graph"

export const GROUPS: { kind: NodeKind; label: string }[] = [
  { kind: "task", label: "Tasks" },
  { kind: "epic", label: "Epics" },
  { kind: "adr", label: "ADRs" },
  { kind: "doc", label: "Docs" },
  { kind: "entry", label: "Entries" },
]
export const KIND_ICON = { epic: Flag, adr: Scale, doc: FileText, entry: Lightbulb, task: BookOpen, spec: ListChecks } as const

/** Open a graph node where it lives: a task on /board, an epic on /roadmap, a doc or ADR in Docs, an entry here. */
export function useOpenNode(onOpenEntry: (id: string) => void) {
  const router = useRouter()
  const { openDoc } = useApp()
  return (n: GraphNode) => {
    if (n.kind === "task") router.push(`/board?task=${n.id}`)
    else if (n.kind === "epic") router.push(`/roadmap?item=${n.id}`)
    else if (n.kind === "entry") onOpenEntry(n.id)
    else void openDoc(n.path)
  }
}

/**
 * What an entry links to and what links back (R053), from GET /api/memory/graph?entry=.
 * Links are inferred from text, so the way to change them is to edit the entry.
 */
export function EntryRelated({ entryId, onOpenEntry }: { entryId: string; onOpenEntry: (id: string) => void }) {
  const { rootParam, summary, board } = useApp()
  const open = useOpenNode(onOpenEntry)
  const [graph, setGraph] = useState<MemoryGraph | null>(null)

  // refetch when the entry changes and on every memory_updated SSE event (AppContext replaces `summary`)
  useEffect(() => {
    let live = true
    fetch(`/api/memory/graph${rootParam}&entry=${encodeURIComponent(entryId)}`)
      .then((r) => r.json())
      .then((g: MemoryGraph) => { if (live) setGraph(g.nodes ? g : { nodes: [], edges: [] }) })
      .catch((e) => {
        console.warn("Loading entry links failed", e)
        if (live) setGraph({ nodes: [], edges: [] })
      })
    return () => { live = false }
  }, [entryId, rootParam, summary])

  const tasks = useMemo(() => new Map(Object.values(board ?? {}).flat().map((t) => [t.id, t])), [board])
  const byId = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph])
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((n): n is GraphNode => !!n)
  const linksTo = pick((graph?.edges ?? []).filter((e) => e.from === entryId).map((e) => e.to))
  const linkedFrom = pick((graph?.edges ?? []).filter((e) => e.to === entryId).map((e) => e.from))

  // tasks from the live board, epics from the node (their roadmap status): one StatusIcon for both, as in Linked docs
  const row = (n: GraphNode & { status?: string }) => {
    const task = n.kind === "task" ? tasks.get(n.id) : undefined
    const status = task ? displayStatus(task) : n.kind === "epic" ? n.status : undefined
    const Icon = KIND_ICON[n.kind]
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => open(n)}
          title={n.path}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {status ? <StatusIcon status={status} className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />}
          {n.id !== n.path && <span className="shrink-0 font-mono text-[11px] text-muted">{n.id}</span>}
          <span className="min-w-0 truncate text-txt">{n.label}</span>
        </button>
      </li>
    )
  }

  const section = (title: string, nodes: GraphNode[]) => (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h4>
      {GROUPS.map(({ kind, label }) => {
        const group = nodes.filter((n) => n.kind === kind)
        if (!group.length) return null
        return (
          <div key={kind}>
            <p className="px-2 text-[11px] text-muted">{label}</p>
            <ul>{group.map(row)}</ul>
          </div>
        )
      })}
    </div>
  )

  return (
    <section aria-label="Related" className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-xs font-semibold text-txt">Related</h3>
      {graph === null ? (
        <p className="text-xs text-muted">Loading links…</p>
      ) : !linksTo.length && !linkedFrom.length ? (
        <p className="text-xs text-muted">No links yet. Mention a task, epic or doc in the entry to link it.</p>
      ) : (
        <>
          {linksTo.length > 0 && section("Links to", linksTo)}
          {linkedFrom.length > 0 && section("Linked from", linkedFrom)}
        </>
      )}
    </section>
  )
}
