"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Unlink } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { GROUPS, KIND_ICON, useOpenNode } from "@/components/memory/EntryRelated"
import { displayStatus } from "@/lib/statuses"
import type { LinkRow } from "@/lib/doc-links"
import type { NodeKind } from "@/lib/memory-graph"
import type { DocLinksData } from "./useDocLinks"

const NODE_KINDS = new Set<string>(GROUPS.map((g) => g.kind))
/** Item id from the file name (T093-x.md → T093); plain docs use their path. */
const idOf = (r: LinkRow) => /^(T\d+|R\d+|E\d+|ADR-\d+)/.exec(r.path.split("/").pop() ?? "")?.[1] ?? r.path

/**
 * What a doc links to, what links to it and its broken links (R056), from GET /api/docs/links via `useDocLinks`.
 * Same grouping and rows as the Memory page's `EntryRelated`. `onNavigate` runs after a row opens (closes a sheet).
 */
export function LinkedDocs({ links, onNavigate }: { links: DocLinksData | null; onNavigate?: () => void }) {
  const router = useRouter()
  const { board } = useApp()
  const open = useOpenNode((id) => router.push(`/memory?entry=${id}`))
  const tasks = useMemo(() => new Map(Object.values(board ?? {}).flat().map((t) => [t.id, t])), [board])

  if (!links) return <p className="text-xs text-muted">Loading links…</p>

  const row = (r: LinkRow, withLine: boolean) => {
    const kind = (NODE_KINDS.has(r.kind) ? r.kind : "doc") as NodeKind
    const id = idOf(r)
    const task = kind === "task" ? tasks.get(id) : undefined
    const Icon = KIND_ICON[kind]
    return (
      <li key={`${r.path}:${r.line}`}>
        <button
          type="button"
          onClick={() => { open({ id, kind, label: r.label, path: r.path }); onNavigate?.() }}
          title={r.path}
          className="flex w-full flex-col rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex w-full min-w-0 items-center gap-2">
            {task ? <StatusIcon status={displayStatus(task)} className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />}
            {kind !== "doc" && <span className="shrink-0 font-mono text-[11px] text-muted">{id}</span>}
            <span className="min-w-0 truncate text-txt">{r.label}</span>
          </span>
          {withLine && <span className="w-full truncate pl-5.5 text-[11px] text-muted">L{r.line} · {r.text}</span>}
        </button>
      </li>
    )
  }

  const section = (title: string, rows: LinkRow[], empty: string, withLine: boolean) => (
    <div className="flex flex-col gap-1.5">
      <h4 className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}<span className="ml-auto font-mono font-normal">{rows.length}</span>
      </h4>
      {!rows.length ? <p className="px-2 text-xs text-muted">{empty}</p> : GROUPS.map(({ kind, label }) => {
        const group = rows.filter((r) => (NODE_KINDS.has(r.kind) ? r.kind : "doc") === kind)
        if (!group.length) return null
        return (
          <div key={kind}>
            <p className="px-2 text-[11px] text-muted">{label}</p>
            <ul>{group.map((r) => row(r, withLine))}</ul>
          </div>
        )
      })}
    </div>
  )

  // one row per target: a doc linking the same file twice lists it once
  const out = [...new Map(links.out.map((r) => [r.path, r])).values()]
  return (
    <div className="flex flex-col gap-5">
      {section("Links to", out, "No links yet", false)}
      {section("Linked from", links.in, "Nothing links here", true)}
      {links.broken.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted">
            Broken<span className="ml-auto font-mono font-normal">{links.broken.length}</span>
          </h4>
          <ul>
            {links.broken.map((r, i) => (
              <li key={i} className="flex items-center gap-2 px-2 py-1 text-sm" title={r.text}>
                <Unlink className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 truncate font-mono text-xs text-muted line-through decoration-muted/50">{r.path}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">L{r.line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
