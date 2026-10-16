"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bot, ChevronRight, Clock, User } from "lucide-react"
import { groupHref, useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import type { EpicRef, PortfolioRow as Row, ProjectStats } from "@/lib/portfolio"

async function fetchPortfolio(): Promise<Row[]> {
  const res = await fetch("/api/portfolio")
  const data = await res.json()
  if (!res.ok || !Array.isArray(data)) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

const REFRESH_ON = new Set(["projects_updated", "task_updated", "task_created", "roadmap_updated"])

/** Portfolio view on All projects (R106 T549): every project / group, most attention first. */
export function PortfolioView() {
  const { t } = useT()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => fetchPortfolio().then((r) => { setRows(r); setError(null) }, (e: Error) => setError(e.message)), [])

  useEffect(() => {
    fetchPortfolio().then(setRows, (e: Error) => setError(e.message))
    const onSse = (e: Event) => { if (REFRESH_ON.has((e as CustomEvent).detail?.type)) load() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  if (error) return <p role="alert" className="text-sm text-danger">{t("projects.portfolioError", { error })}</p>
  if (!rows) return <p className="text-sm text-muted">{t("projects.loading")}</p>
  return (
    <ul data-portfolio className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {rows.map((r) => <PortfolioRow key={r.kind === "group" ? `g:${r.slug}` : r.id} row={r} />)}
    </ul>
  )
}

/** One project, or a group with its members nested (collapsed until opened). Clicking the name opens its roadmap. */
export function PortfolioRow({ row, nested = false }: { row: Row; nested?: boolean }) {
  const { t } = useT()
  const { onProjectChange } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const group = row.kind === "group" ? row : null
  const openRoadmap = () => (group ? router.push(groupHref("/roadmap", group.slug)) : onProjectChange((row as ProjectStats).id, "/roadmap"))
  const openEpic = (e: EpicRef) => onProjectChange(e.project, `/roadmap?item=${encodeURIComponent(e.id)}`)

  return (
    <li data-portfolio-row={group ? `group:${group.slug}` : (row as ProjectStats).id} className={cn("px-3 py-3", nested && "pl-9")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-1">
          {group && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={t(open ? "projects.portfolioCollapse" : "projects.portfolioExpand", { name: row.name })}
              className="grid size-6 shrink-0 place-items-center rounded text-muted hover:text-txt focus-visible:ring-2 focus-visible:ring-accent outline-none"
            >
              <ChevronRight className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
            </button>
          )}
          <button
            type="button"
            onClick={openRoadmap}
            aria-label={t("projects.portfolioOpenRoadmap", { name: row.name })}
            className="truncate rounded-sm text-left text-sm font-medium text-txt underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent outline-none"
            data-user-content
          >
            {row.name}
          </button>
          {group && <span className="shrink-0 rounded-sm bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">{t("projects.portfolioGroup", { n: group.members.length })}</span>}
        </div>
        <Stats row={row} />
      </div>
      {(row.atRisk.length > 0 || row.overdue.length > 0) && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("projects.portfolioAttention", { name: row.name })}>
          {row.atRisk.map((e) => (
            <EpicChip key={`r:${e.project}:${e.id}`} epic={e} kind="at-risk" onOpen={() => openEpic(e)} />
          ))}
          {row.overdue.map((e) => (
            <EpicChip key={`o:${e.project}:${e.id}`} epic={e} kind="overdue" onOpen={() => openEpic(e)} />
          ))}
        </ul>
      )}
      {group && open && (
        <ul className="-mx-3 mt-3 -mb-3 divide-y divide-border border-t border-border bg-bg/40">
          {group.members.map((m) => <PortfolioRow key={m.id} row={m} nested />)}
        </ul>
      )}
    </li>
  )
}

function Stats({ row }: { row: Row }) {
  const { t, tn } = useT()
  const f = useFormat()
  const { done, total } = row.epics
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <div className="flex items-center gap-2">
        <dt className="sr-only">{t("projects.portfolioProgress")}</dt>
        <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-surface2 ring-1 ring-border2 ring-inset">
          <span className="block h-full rounded-full bg-teal" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
        </span>
        <dd>{t("projects.portfolioEpics", { done, total })}</dd>
      </div>
      {row.blocked > 0 && (
        <div><dt className="sr-only">{t("projects.portfolioBlockedLabel")}</dt><dd className="font-medium text-danger">{tn("projects.portfolioBlocked", row.blocked)}</dd></div>
      )}
      <div title={t("projects.portfolioWeekTitle")}>
        <dt className="sr-only">{t("projects.portfolioWeekTitle")}</dt>
        <dd data-done-week aria-label={t("projects.portfolioWeek", { ai: row.doneThisWeek.ai, human: row.doneThisWeek.human })} className="flex items-center gap-1.5 tabular-nums">
          <Bot aria-hidden className="size-3.5" /><span className="text-txt">{row.doneThisWeek.ai}</span>
          <User aria-hidden className="ml-1 size-3.5" /><span className="text-txt">{row.doneThisWeek.human}</span>
          <span>{t("projects.portfolioWeekShort")}</span>
        </dd>
      </div>
      <div>
        <dt className="sr-only">{t("projects.portfolioLastLabel")}</dt>
        <dd title={row.lastActivity ? f.dateTime(row.lastActivity) : undefined}>
          {row.lastActivity ? t("projects.portfolioLast", { when: f.timeAgo(row.lastActivity) }) : t("projects.portfolioNoActivity")}
        </dd>
      </div>
    </dl>
  )
}

/** An at-risk (⚠, the roadmap's amber mark) or overdue epic; opens that epic in its own project. */
function EpicChip({ epic, kind, onOpen }: { epic: EpicRef; kind: "at-risk" | "overdue"; onOpen: () => void }) {
  const { t } = useT()
  const Icon = kind === "at-risk" ? AlertTriangle : Clock
  return (
    <li className="min-w-0 max-w-full">
      <button
        type="button"
        onClick={onOpen}
        data-epic-chip={kind}
        aria-label={t(kind === "at-risk" ? "projects.portfolioAtRiskChip" : "projects.portfolioOverdueChip", { id: epic.id, title: epic.title })}
        className={cn(
          "flex max-w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent",
          kind === "at-risk" ? "bg-amber/15 text-amber hover:bg-amber/25" : "bg-danger/15 text-danger hover:bg-danger/25",
        )}
      >
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="font-mono">{epic.id}</span>
        <span className="truncate" data-user-content>{epic.title}</span>
      </button>
    </li>
  )
}
