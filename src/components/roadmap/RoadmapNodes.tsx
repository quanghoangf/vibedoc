"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RoadmapItem, RoadmapStatus, TaskStatus } from "@/types"
import type { DueState, TaskDueSummary } from "@/lib/roadmap-health"
import { formatDay } from "./timeline"
import { FEATURE_W, HORIZON_W } from "./layout"
import { AgentMark, useEpicAgent } from "./AgentMark"

export type RoadmapNodeData = {
  item: RoadmapItem
  progress?: { done: number; total: number }  // derived, never persisted
  drift?: string[]
  dueState?: DueState | null
  taskDue?: TaskDueSummary | null
  taskDueSoon?: boolean
  taskStatuses?: TaskStatus[]                  // feature: linked tasks in order, cancelled/missing left out
  nextTaskId?: string | null                   // feature: what vibedoc_next_task would hand out
  chapter?: number                             // horizon: 1-based position on the spine
  epics?: { done: number; total: number }      // horizon: child epics
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

export const STATUS_LABEL: Record<RoadmapStatus, string> = { "in-progress": "Live", done: "Done", planned: "Planned" }

/** Roadmap status as a dot: live = accent with a pulse, done = teal, planned = hollow. */
export function StatusDot({ status, className }: { status: RoadmapStatus; className?: string }) {
  return (
    <span title={STATUS_LABEL[status]} aria-label={STATUS_LABEL[status]} className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {status === "in-progress" && <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />}
      <span
        className={cn(
          "relative h-full w-full rounded-full",
          status === "done" && "bg-teal",
          status === "in-progress" && "bg-accent",
          status === "planned" && "border border-muted",
        )}
      />
    </span>
  )
}

export function StatusPill({ status }: { status: RoadmapStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        status === "done" && "border-teal/40 text-teal",
        status === "in-progress" && "border-accent/50 text-accent",
        status === "planned" && "border-dashed border-border2 text-muted",
      )}
    >
      <StatusDot status={status} className="h-1.5 w-1.5" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export const TASK_STATUS_BG: Record<TaskStatus, string> = {
  done: "bg-teal",
  "in-progress": "bg-amber",
  blocked: "bg-danger",
  todo: "bg-border2",
  cancelled: "bg-border",
}

/** One segment per task, colored by its board status (same colors as the board). */
export function SegmentedProgress({ statuses, className }: { statuses?: TaskStatus[]; className?: string }) {
  if (!statuses?.length) return null
  const done = statuses.filter((s) => s === "done").length
  return (
    <div className={cn("flex h-1.5 min-w-0 flex-1 gap-0.5", className)} title={`${done}/${statuses.length} tasks done`}>
      {statuses.map((s, i) => (
        <span key={i} className={cn("h-full flex-1 rounded-[1px]", TASK_STATUS_BG[s])} />
      ))}
    </div>
  )
}

/** Small progress ring; color follows `className` (currentColor). */
export function ProgressRing({ value, total, className }: { value: number; total: number; className?: string }) {
  const r = 14
  const c = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  return (
    <span className={cn("relative inline-flex h-9 w-9 shrink-0 items-center justify-center", className)} title={`${value}/${total} tasks done`}>
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
  if (!progress) return null
  const pct = Math.round((progress.done / progress.total) * 100)
  return (
    <div className="flex items-center gap-1.5" title={`${progress.done}/${progress.total} done`}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted">{progress.done}/{progress.total}</span>
    </div>
  )
}

export function DueChip({ due, state }: { due: string | null; state?: DueState | null }) {
  if (!due) return null
  return (
    <span
      className={cn(
        "font-mono text-[10px]",
        state === "overdue" ? "text-danger" : state === "soon" ? "text-amber" : "text-muted",
      )}
    >
      Due {formatDay(due)}
    </span>
  )
}

/** The single most urgent date line for a card: overdue tasks, then the epic's own due, then the next task due. */
function DueNote({ data }: { data: RoadmapNodeData }) {
  const s = data.taskDue
  if (s && s.overdue > 0) {
    return <span className="font-mono text-[10px] text-danger">{s.overdue} {s.overdue === 1 ? "task" : "tasks"} overdue</span>
  }
  if (data.item.due) return <DueChip due={data.item.due} state={data.dueState} />
  if (s?.next) return <span className={cn("font-mono text-[10px]", data.taskDueSoon ? "text-amber" : "text-muted")}>Next due {formatDay(s.next)}</span>
  return null
}

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
  const { item, progress, epics, chapter } = data
  const status = item.status
  return (
    <div
      style={{ width: HORIZON_W }}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-shadow duration-(--duration-base)",
        status === "in-progress" && "border-accent/60 shadow-[0_0_0_1px_rgb(var(--rgb-accent)/0.25),0_10px_30px_-12px_rgb(var(--rgb-accent)/0.6)]",
        status === "done" && "border-teal/40",
        status === "planned" && "border-dashed border-border2",
        selected && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg",
      )}
    >
      <Handles />
      <span
        className={cn(
          "font-mono text-2xl font-semibold leading-none tabular-nums",
          status === "in-progress" ? "text-accent" : status === "done" ? "text-teal" : "text-muted",
        )}
      >
        {chapter ? String(chapter).padStart(2, "0") : "··"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase leading-snug tracking-wider text-txt">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted">
          {epics && epics.total > 0 && <span>{epics.done}/{epics.total} epics</span>}
          <DueChip due={item.due} state={data.dueState} />
        </p>
      </div>
      {progress && (
        <ProgressRing value={progress.done} total={progress.total} className={status === "done" ? "text-teal" : "text-accent"} />
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
  const agent = useEpicAgent(item.id)
  const drifting = !!data.drift?.length
  const ring = selected && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg"

  if (item.status === "done") {
    return (
      <div
        style={{ width: FEATURE_W }}
        className={cn("group relative flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 hover:border-teal/40", ring)}
      >
        <Handles />
        <Check className="h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={3} />
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted group-hover:text-txt" title={item.title}>{item.title}</p>
        {agent ? <AgentMark id={item.id} />
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
          ? "border-accent/50 bg-surface shadow-[0_8px_24px_-10px_rgb(var(--rgb-accent)/0.55)]"
          : "border-dashed border-border2 bg-bg hover:border-muted",
        ring,
      )}
    >
      <Handles />
      {live && <span className={cn("absolute -inset-y-px -left-px w-[3px] rounded-l-lg", drifting ? "bg-amber" : "bg-accent")} />}
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-muted">{item.id}</span>
        {agent ? (
          <AgentMark id={item.id} />
        ) : live ? (
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-accent"><StatusDot status="in-progress" className="h-1.5 w-1.5" />Live</span>
        ) : (
          <span className="uppercase tracking-wider text-muted">{item.tasks.length ? `${item.tasks.length} tasks` : "No tasks yet"}</span>
        )}
      </div>
      <p className={cn("line-clamp-2 text-[13px] leading-snug", live ? "font-medium text-txt" : "text-txt/80")} title={item.title}>
        {item.title}
      </p>
      {taskStatuses && taskStatuses.length > 0 && (
        <div className="flex items-center gap-2">
          <SegmentedProgress statuses={taskStatuses} />
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {live && nextTaskId ? <>next <span className="text-txt">{nextTaskId}</span></> : `${taskStatuses.filter((s) => s === "done").length}/${taskStatuses.length}`}
          </span>
        </div>
      )}
      <DueNote data={data} />
      <DriftMark drift={data.drift} />
    </div>
  )
}

export const nodeTypes = { horizon: HorizonNode, feature: FeatureNode }
