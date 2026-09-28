"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RoadmapItem, RoadmapStatus } from "@/types"
import type { DueState, TaskDueSummary } from "@/lib/roadmap-health"
import { formatDay } from "./timeline"
import { FEATURE_W, HORIZON_W } from "./layout"

export type RoadmapNodeData = {
  item: RoadmapItem
  progress?: { done: number; total: number }  // derived, never persisted
  drift?: string[]
  dueState?: DueState | null
  taskDue?: TaskDueSummary | null
  taskDueSoon?: boolean
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

export function StatusBadge({ status, className }: { status: RoadmapStatus; className?: string }) {
  return (
    <span
      title={status}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border-2",
        status === "done" && "border-teal bg-teal text-bg",
        status === "in-progress" && "border-accent bg-[linear-gradient(90deg,var(--color-accent)_50%,var(--color-surface)_50%)]",
        status === "planned" && "border-muted bg-surface",
        className,
      )}
    >
      {status === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}

export function Progress({ progress }: { progress?: RoadmapNodeData["progress"] }) {
  if (!progress) return null
  const pct = Math.round((progress.done / progress.total) * 100)
  return (
    <div className="mt-1.5 flex items-center gap-1.5" title={`${progress.done}/${progress.total} done`}>
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
    <p
      className={cn(
        "mt-0.5 font-mono text-[10px]",
        state === "overdue" ? "text-danger" : state === "soon" ? "text-amber" : "text-muted",
      )}
    >
      Due {formatDay(due)}
    </p>
  )
}

function TaskDueLine({ summary, soon }: { summary?: TaskDueSummary | null; soon?: boolean }) {
  if (!summary) return null
  if (summary.overdue > 0) {
    return (
      <p className="mt-0.5 font-mono text-[10px] text-danger">
        {summary.overdue} {summary.overdue === 1 ? "task" : "tasks"} overdue
      </p>
    )
  }
  if (!summary.next) return null
  return (
    <p className={cn("mt-0.5 font-mono text-[10px]", soon ? "text-amber" : "text-muted")}>
      Next task due {formatDay(summary.next)}
    </p>
  )
}

function DriftMark({ drift }: { drift?: string[] }) {
  if (!drift?.length) return null
  return (
    <span title={drift.join("\n")} className="absolute -left-2.5 -top-2.5 rounded-full bg-bg p-0.5 text-amber">
      <AlertTriangle className="h-4 w-4" />
    </span>
  )
}

export function HorizonNode({ data, selected }: NodeProps<RoadmapNode>) {
  return (
    <div
      style={{ width: HORIZON_W }}
      className={cn(
        "relative rounded-lg border-2 border-accent bg-accent/15 px-4 py-3 text-center",
        selected && "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg",
      )}
    >
      <Handles />
      <p className="text-base font-semibold text-txt leading-snug">{data.item.title}</p>
      <DueChip due={data.item.due} state={data.dueState} />
      <Progress progress={data.progress} />
      <DriftMark drift={data.drift} />
      <StatusBadge status={data.item.status} className="absolute -right-2.5 -top-2.5" />
    </div>
  )
}

export function FeatureNode({ data, selected }: NodeProps<RoadmapNode>) {
  const { item } = data
  return (
    <div
      style={{ width: FEATURE_W }}
      className={cn(
        "relative rounded-md border-2 border-border2 bg-surface px-3 py-2 text-center",
        selected && "border-accent",
      )}
    >
      <Handles />
      <p className="line-clamp-2 text-sm text-txt leading-snug" title={item.title}>{item.title}</p>
      <DueChip due={item.due} state={data.dueState} />
      <TaskDueLine summary={data.taskDue} soon={data.taskDueSoon} />
      {item.tasks.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {item.tasks.map((t) => (
            <span key={t} className="rounded-sm border border-border px-1 font-mono text-[10px] text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
      <Progress progress={data.progress} />
      <DriftMark drift={data.drift} />
      <StatusBadge status={item.status} className="absolute -right-2.5 -top-2.5" />
    </div>
  )
}

export const nodeTypes = { horizon: HorizonNode, feature: FeatureNode }
