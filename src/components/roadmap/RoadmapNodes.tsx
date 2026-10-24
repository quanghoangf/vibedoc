"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RoadmapItem, RoadmapStatus, TaskStatus } from "@/types"
import type { DueState, TaskDueSummary } from "@/lib/roadmap-health"
import { useFormat, useT } from "@/context/LanguageContext"
import { FEATURE_W, HORIZON_W } from "./layout"
import { AgentMark } from "@/components/chat/AgentMark"
import { useItemAgent } from "@/context/ChatContext"
import type { MessageKey } from "@/i18n"
import { ProgressMarks, STATUS_META } from "@/components/shared/StatusIcon"

export type RoadmapNodeData = {
  item: RoadmapItem
  progress?: { done: number; total: number }  // derived, never persisted
  drift?: string[]
  dueState?: DueState | null
  taskDue?: TaskDueSummary | null
  taskDueSoon?: boolean
  taskStatuses?: TaskStatus[]                  // feature: linked tasks in order, cancelled/missing left out
  nextTaskId?: string | null                   // feature: what vibedoc_next_task would hand out
  receded?: boolean                            // feature, done, in a horizon with live epics: drawn faded
  chapter?: number                             // horizon: 1-based position on the spine
  epics?: { done: number; total: number }      // horizon: child epics
  collapsed?: boolean                          // horizon, all epics done: drawn as one compact node
  onToggle?: () => void                        // horizon, all epics done: collapse / expand its epics
}
export type RoadmapNode = Node<RoadmapNodeData, "horizon" | "feature">

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

/** One invisible source + target handle per side; edges pick `side` / `side-t`. */
function Handles() {
  return (
    <>
      {SIDES.map((p) => (
        <Handle key={p} id={p} type="source" position={p} isConnectable={false} className="opacity-0" />
      ))}
      {SIDES.map((p) => (
        <Handle key={`${p}-t`} id={`${p}-t`} type="target" position={p} isConnectable={false} className="opacity-0" />
      ))}
    </>
  )
}

export const STATUS_KEY: Record<RoadmapStatus, MessageKey> = {
  "in-progress": "roadmap.statusActive", paused: "roadmap.statusPaused", done: "roadmap.statusDone", planned: "roadmap.statusPlanned",
}

/** A roadmap status's name in the UI language. */
export function useRoadmapStatusLabel(): (status: RoadmapStatus) => string {
  const { t } = useT()
  return (status) => t(STATUS_KEY[status])
}

/** Roadmap status as a dot, in the task status hues (One Status Language): live = amber with a pulse, done = teal, planned = hollow. */
export function StatusDot({ status, className }: { status: RoadmapStatus; className?: string }) {
  const label = useRoadmapStatusLabel()(status)
  return (
    <span title={label} aria-label={label} className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {status === "in-progress" && <span className="absolute inset-0 animate-ping rounded-full bg-amber/60" />}
      <span
        className={cn(
          "relative h-full w-full rounded-full",
          status === "done" && "bg-teal",
          status === "in-progress" && "bg-amber",
          status === "planned" && "border border-muted",
          status === "paused" && "bg-muted",
        )}
      />
    </span>
  )
}

/** A roadmap status in the task status chip's look (One Status Language): planned reads as todo's hollow circle. */
export function StatusPill({ status }: { status: RoadmapStatus }) {
  const label = useRoadmapStatusLabel()(status)
  const meta = STATUS_META[status === "planned" ? "todo" : status]
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none", meta.chip)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  )
}

export const TASK_STATUS_BG: Record<TaskStatus, string> = {
  done: "bg-teal",
  "in-progress": "bg-amber",
  review: "bg-review",
  blocked: "bg-danger",
  paused: "bg-muted/60",
  todo: "bg-border2",
  cancelled: "bg-border",
}

/** One segment per task, as on the board (review hatched, never solid); named "0/4 done · 4 in review". */
export function SegmentedProgress({ statuses, className }: { statuses?: TaskStatus[]; className?: string }) {
  if (!statuses?.length) return null
  return <ProgressMarks statuses={statuses} className={cn("h-1.5 flex-1", className)} markClassName="rounded-[1px]" />
}

/** Small progress ring; color follows `className` (currentColor). */
export function ProgressRing({ value, total, className }: { value: number; total: number; className?: string }) {
  const r = 14
  const c = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  const { t } = useT()
  return (
    <span className={cn("relative inline-flex h-9 w-9 shrink-0 items-center justify-center", className)} title={t("roadmap.tasksDone", { done: value, total })}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-border" />
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" stroke="currentColor" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="font-mono text-[9px] text-txt">{Math.round(pct * 100)}</span>
    </span>
  )
}

export function Progress({ progress }: { progress?: RoadmapNodeData["progress"] }) {
  const { t } = useT()
  if (!progress) return null
  const pct = Math.round((progress.done / progress.total) * 100)
  return (
    <div className="flex items-center gap-1.5" title={t("roadmap.doneOfTotal", { done: progress.done, total: progress.total })}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted">{progress.done}/{progress.total}</span>
    </div>
  )
}

export function DueChip({ due, state }: { due: string | null; state?: DueState | null }) {
  const f = useFormat()
  const { t } = useT()
  if (!due) return null
  return (
    <span
      className={cn(
        "font-mono text-[10px]",
        state === "overdue" ? "text-danger" : state === "soon" ? "text-amber" : "text-muted",
      )}
    >
      {t("board.dueOn", { date: f.day(due) })}
    </span>
  )
}

/** The single most urgent date line for a card: overdue tasks, then the epic's own due, then the next task due. */
function DueNote({ data }: { data: RoadmapNodeData }) {
  const f = useFormat()
  const { t, tn } = useT()
  const s = data.taskDue
  if (s && s.overdue > 0) {
    return <span className="font-mono text-[10px] text-danger">{tn("roadmap.tasksOverdue", s.overdue)}</span>
  }
  if (data.item.due) return <DueChip due={data.item.due} state={data.dueState} />
  if (s?.next) return <span className={cn("font-mono text-[10px]", data.taskDueSoon ? "text-amber" : "text-muted")}>{t("roadmap.nextDue", { date: f.day(s.next) })}</span>
  return null
}

/** `drift`: the item's needs-attention lines, already worded (RoadmapTab's driftText). */
function DriftMark({ drift }: { drift?: string[] }) {
  if (!drift?.length) return null
  return (
    <span title={drift.join("\n")} className="absolute -left-2 -top-2 rounded-full bg-bg p-0.5 text-amber">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  )
}

/** A horizon is a chapter: big number, title, epic count, and a ring for task progress. */
export function HorizonNode({ data, selected }: NodeProps<RoadmapNode>) {
  const { item, progress, epics, chapter, collapsed, onToggle } = data
  const { t, tn } = useT()
  const status = item.status
  return (
    <div
      style={{ width: HORIZON_W }}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-shadow duration-(--duration-base)",
        status === "in-progress" && "border-amber/50",
        status === "done" && "border-teal/40",
        status === "planned" && "border-dashed border-border2",
        status === "paused" && "border-border2 opacity-75",
        selected && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg",
      )}
    >
      <Handles />
      <span
        className={cn(
          "font-mono text-2xl font-semibold leading-none tabular-nums",
          status === "in-progress" ? "text-amber" : status === "done" ? "text-teal" : "text-muted",
        )}
      >
        {chapter ? String(chapter).padStart(2, "0") : "··"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase leading-snug tracking-wider text-txt">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted">
          {epics && epics.total > 0 && <span>{collapsed ? tn("roadmap.epicsAllDone", epics.total) : t("roadmap.epicsCount", { done: epics.done, total: epics.total })}</span>}
          <DueChip due={item.due} state={data.dueState} />
          {onToggle && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle() }}
              aria-expanded={!collapsed}
              aria-label={t(collapsed ? "roadmap.showEpicsLabel" : "roadmap.collapseEpicsLabel", { title: item.title })}
              className="nodrag nopan rounded-xs text-accent underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t(collapsed ? "roadmap.showEpics" : "roadmap.collapseEpics")}
            </button>
          )}
        </p>
      </div>
      {progress && (
        <ProgressRing value={progress.done} total={progress.total} className="text-teal" />
      )}
      <DriftMark drift={data.drift} />
    </div>
  )
}

/**
 * Three looks so the eye lands on live work: live = lit card with task segments and the next task,
 * done = one quiet line, planned = dashed outline. Height stays under ROW_H (layout.ts) so saved positions never overlap.
 */
export function FeatureNode({ data, selected }: NodeProps<RoadmapNode>) {
  const { item, taskStatuses, nextTaskId } = data
  const agent = useItemAgent({ kind: "epic", id: item.id })
  const { t, tn } = useT()
  const ring = selected && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg"

  if (item.status === "done") {
    return (
      <div
        style={{ width: FEATURE_W }}
        className={cn(
          "group relative flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 transition-opacity duration-(--duration-fast) hover:border-teal/40",
          data.receded && !selected && "opacity-60 hover:opacity-100",
          ring,
        )}
      >
        <Handles />
        <Check className="h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={3} />
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted group-hover:text-txt" title={item.title}>{item.title}</p>
        {agent ? <AgentMark attach={{ kind: "epic", id: item.id }} />
          : data.progress && <span className="font-mono text-[10px] text-muted">{data.progress.done}/{data.progress.total}</span>}
        <DriftMark drift={data.drift} />
      </div>
    )
  }

  const live = item.status === "in-progress"
  return (
    <div
      style={{ width: FEATURE_W }}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-shadow duration-(--duration-base)",
        live
          ? "border-amber/50 bg-surface"
          : "border-dashed border-border2 bg-bg hover:border-muted",
        item.status === "paused" && "opacity-70",
        ring,
      )}
    >
      <Handles />
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-muted">{item.id}</span>
        {agent ? (
          <AgentMark attach={{ kind: "epic", id: item.id }} />
        ) : live ? (
          <span className="flex items-center gap-1.5 font-sans text-[11px] text-amber"><StatusDot status="in-progress" className="h-1.5 w-1.5" />{t("roadmap.statusActive")}</span>
        ) : (
          <span className="font-sans text-[11px] text-muted">{item.tasks.length ? tn("roadmap.taskCount", item.tasks.length) : t("roadmap.noTasksYet")}</span>
        )}
      </div>
      <p className={cn("line-clamp-2 text-[13px] leading-snug", live ? "font-medium text-txt" : "text-txt/80")} title={item.title}>
        {item.title}
      </p>
      {taskStatuses && taskStatuses.length > 0 && (
        <div className="flex items-center gap-2">
          <SegmentedProgress statuses={taskStatuses} />
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {live && nextTaskId ? <>{t("roadmap.nextTask")} <span className="text-txt">{nextTaskId}</span></> : t("board.progressDone", { done: taskStatuses.filter((s) => s === "done").length, total: taskStatuses.length })}
          </span>
        </div>
      )}
      <DueNote data={data} />
      <DriftMark drift={data.drift} />
    </div>
  )
}

export const nodeTypes = { horizon: HorizonNode, feature: FeatureNode }
