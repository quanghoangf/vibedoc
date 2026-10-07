"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowLeftRight, ArrowRight, FileQuestion, Unlink, Waypoints } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { GROUPS, KIND_ICON, useOpenNode } from "@/components/memory/EntryRelated"
import { displayStatus } from "@/lib/statuses"
import { graphHref, mergeLinkRows, type LinkDirection, type LinkRow, type MergedLinkRow } from "@/lib/doc-links"
import type { NodeKind } from "@/lib/memory-graph"
import type { DocLinksData } from "./useDocLinks"
import { LinkPreview, type PreviewTarget } from "./LinkPreview"
import { flashElement, revealLink } from "./MarkdownRenderer"
import { useT } from "@/context/LanguageContext"

/** Label Caps (DESIGN.md): mono 10px/500, 0.06em, uppercase. */
const LABEL_CAPS = "flex items-center font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted"
const ROW = "rounded-md px-2 py-1 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent"

/** Direction markers: → links to, ← linked from, ⇄ both. Both reads in text colour, one way stays muted. */
const DIRECTION = {
  out: { Icon: ArrowRight, label: "docs.linksTo" },
  in: { Icon: ArrowLeft, label: "docs.linkedFrom" },
  both: { Icon: ArrowLeftRight, label: "docs.dirBoth" },
} as const
type Filter = "all" | "to" | "from"
const FILTERS: { id: Filter; label: "docs.linksAll" | "docs.linksToFilter" | "docs.linksFromFilter"; keep: (d: LinkDirection) => boolean }[] = [
  { id: "all", label: "docs.linksAll", keep: () => true },
  { id: "to", label: "docs.linksToFilter", keep: (d) => d !== "in" },
  { id: "from", label: "docs.linksFromFilter", keep: (d) => d !== "out" },
]

const NODE_KINDS = new Set<string>(GROUPS.map((g) => g.kind))
/** Rows carry data-preview-* so one delegated LinkPreview serves the whole panel. */
function previewOf(el: Element): { anchor: Element; target: PreviewTarget } | null {
  const row = el.closest<HTMLElement>("[data-preview-path]")
  if (!row) return null
  const { previewPath = "", previewKind = "doc", previewLabel = "", previewBroken } = row.dataset
  return { anchor: row, target: previewBroken !== undefined ? { broken: previewPath } : { path: previewPath, kind: previewKind, label: previewLabel } }
}

/** Item id from the file name (T093-x.md → T093); plain docs use their path. */
const idOf = (r: LinkRow) => /^(T\d+|R\d+|E\d+|ADR-\d+)/.exec(r.path.split("/").pop() ?? "")?.[1] ?? r.path

/**
 * What a doc links to, what links to it, its broken links and stale path mentions (R056), from GET /api/docs/links via `useDocLinks`.
 * Same grouping and rows as the Memory page's `EntryRelated`. `onNavigate` runs after a row opens (closes a sheet).
 * `path` (the open doc) adds a Show in graph link.
 */
export function LinkedDocs({ links, path, onNavigate }: { links: DocLinksData | null; path?: string; onNavigate?: () => void }) {
  const router = useRouter()
  const { board } = useApp()
  const open = useOpenNode((id) => router.push(`/memory?entry=${id}`))
  const { t } = useT()
  const [filter, setFilter] = useState<Filter>("all")
  const tasks = useMemo(() => new Map(Object.values(board ?? {}).flat().map((t) => [t.id, t])), [board])
  const ref = useRef<HTMLDivElement>(null)
  // What each row showed last time (data-sig), so a live update flashes only the rows it changed. Reset while the
  // links or the board load, so opening a doc flashes nothing.
  const seen = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || !links || !board) {
      seen.current = null
      return
    }
    const next = new Map<string, string>()
    for (const el of root.querySelectorAll<HTMLElement>("[data-sig]")) {
      const key = el.dataset.rowKey ?? "", sig = el.dataset.sig ?? ""
      next.set(key, sig)
      if (seen.current && seen.current.get(key) !== sig) flashElement(el)
    }
    seen.current = next
  }, [links, board])

  const row = (r: MergedLinkRow) => {
    const kind = (NODE_KINDS.has(r.kind) ? r.kind : "doc") as NodeKind
    const id = idOf(r)
    const task = kind === "task" ? tasks.get(id) : undefined
    // tasks from the live board, epics from the row (their roadmap status): one StatusIcon for both
    const status = task ? displayStatus(task) : kind === "epic" ? r.status : undefined
    const Icon = KIND_ICON[kind]
    const dir = DIRECTION[r.direction]
    // where this file names the open doc; an out-only row has no snippet of its own
    const snippet = r.direction !== "out" ? r.context ?? r.text : null
    return (
      <li key={r.path}>
        <button
          type="button"
          onClick={() => { open({ id, kind, label: r.label, path: r.path }); onNavigate?.() }}
          data-preview-path={r.path}
          data-preview-kind={kind}
          data-preview-label={r.label}
          data-direction={r.direction}
          data-row-key={r.path}
          data-sig={`${r.label}|${status ?? ""}|${r.direction}|${snippet ?? ""}`}
          className={cn("flex w-full flex-col gap-0.5", ROW)}
        >
          <span className="flex w-full min-w-0 items-center gap-2">
            {status ? <StatusIcon status={status} className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />}
            {id !== r.path && <span className="shrink-0 font-mono text-[11px] text-muted">{id}</span>}
            <span className="min-w-0 truncate text-[13px] font-medium text-txt">{r.label}</span>
            <span title={t(dir.label)} className={cn("ml-auto shrink-0", r.direction === "both" ? "text-txt" : "text-muted")}>
              <dir.Icon className="size-3.5" aria-hidden />
              <span className="sr-only">{t(dir.label)}</span>
            </span>
          </span>
          {snippet && <span className="w-full truncate pl-5.5 text-[11px] text-muted"><span className="font-mono">L{r.line}</span> · {snippet}</span>}
        </button>
      </li>
    )
  }

  // One list, every linked file once, grouped by kind; the filter narrows it to one direction
  const linked = (rows: MergedLinkRow[]) => {
    const shown = rows.filter((r) => FILTERS.find((f) => f.id === filter)?.keep(r.direction))
    const empty = filter === "from" ? t("docs.nothingLinksHere") : t("docs.noLinksYet")
    return (
      <div className="flex flex-col gap-3">
        {rows.length > 0 && (
          <div role="group" aria-label={t("docs.linkFilter")} className="flex rounded-md border border-border p-0.5">
            {FILTERS.map((f) => {
              const n = rows.filter((r) => f.keep(r.direction)).length
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-accent",
                    filter === f.id ? "bg-surface2 font-medium text-txt" : "text-muted hover:text-txt",
                  )}
                >
                  {t(f.label)}<span className="font-mono text-[11px] text-muted">{n}</span>
                </button>
              )
            })}
          </div>
        )}
        {!shown.length ? <p className="px-2 text-xs text-muted">{empty}</p> : GROUPS.map(({ kind, label }) => {
          const group = shown.filter((r) => (NODE_KINDS.has(r.kind) ? r.kind : "doc") === kind)
          if (!group.length) return null
          const Icon = KIND_ICON[kind]
          return (
            <section key={kind} className="flex flex-col gap-1">
              <h3 className={cn(LABEL_CAPS, "gap-1.5 border-b border-border px-2 pb-1.5")}>
                <Icon className="size-3" aria-hidden />{t(label)}<span className="ml-auto">{group.length}</span>
              </h3>
              <ul>{group.map(row)}</ul>
            </section>
          )
        })}
      </div>
    )
  }

  // Broken links and stale path mentions: each row scrolls the preview to the spot and flashes it
  const missSection = (title: string, rows: LinkRow[], broken: boolean) => rows.length > 0 && (
    <div className="flex flex-col gap-1.5">
      <h3 className={LABEL_CAPS}>
        {title}<span className="ml-auto">{rows.length}</span>
      </h3>
      <ul>
        {rows.map((r, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => { onNavigate?.(); const p = document.querySelector(".doc-preview"); if (p) revealLink(p, r.path) }}
              {...(broken ? { "data-preview-path": r.path, "data-preview-broken": "" } : { title: t("docs.fileNotFound") })}
              className={cn("flex w-full items-center gap-2", ROW)}
            >
              {broken ? <Unlink className="size-3.5 shrink-0 text-muted" aria-hidden /> : <FileQuestion className="size-3.5 shrink-0 text-muted" aria-hidden />}
              <span className={cn("min-w-0 truncate font-mono text-xs text-muted", broken && "underline decoration-muted decoration-dashed underline-offset-3")}>{r.path}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">L{r.line}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  // one row per linked file, whichever way it links (T506)
  const rows = useMemo(() => links ? mergeLinkRows(links.out, links.in) : [], [links])
  // the wrapper is always mounted so LinkPreview's delegated listeners attach once
  return (
    <div ref={ref} data-preview-bounds>
      <LinkPreview containerRef={ref} resolve={previewOf} />
      {!links ? <p className="text-xs text-muted">{t("docs.loadingLinks")}</p> : (
        <div className="flex flex-col gap-5">
          {linked(rows)}
          {missSection(t("docs.broken"), links.broken, true)}
          {missSection(t("docs.stalePaths"), links.stale, false)}
          {path && (
            <Link href={graphHref(path)} onClick={onNavigate} className={cn("flex items-center gap-2 text-muted hover:text-txt", ROW)}>
              <Waypoints className="size-3.5 shrink-0" aria-hidden />
              {t("docs.showInGraph")}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
