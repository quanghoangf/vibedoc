"use client"

import { useState } from "react"
import Link from "next/link"
import { CornerUpLeft, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"
import { AgentDot } from "@/components/chat/AgentMark"
import { latestReview } from "@/lib/review"

interface TaskCardProps {
  task: Task
  onOpen: () => void
}

/** "R043 — Task verification & review" → { id: "R043", title: "Task verification & review" }; other phases as-is. */
function epicOf(phase: string): { id: string | null; title: string } {
  const m = phase.match(/^(R\d+)\s*[—–-]\s*(.*)$/)
  return m ? { id: m[1], title: m[2] } : { id: null, title: phase }
}

/**
 * A task on the board. The column already says the status, so the card doesn't repeat it.
 * Click (or Enter) opens the task panel, where every action lives; drag moves it between columns.
 */
export function TaskCard({ task, onOpen }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const epic = task.phase ? epicOf(task.phase) : null
  const sentBack = task.status === "todo" && task.raw ? latestReview(task.raw) : null
  const size = task.size && task.size !== "—" ? task.size.split(" ")[0] : null
  const done = task.status === "done" || task.status === "cancelled"

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`${task.id} ${task.title}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id)
        e.dataTransfer.effectAllowed = "move"
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{ viewTransitionName: `task-${task.file.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-left outline-hidden",
        "transition-[border-color,background-color,opacity,box-shadow] duration-(--duration-fast)",
        "hover:border-border2 hover:bg-surface2/50 focus-visible:border-accent/60 focus-visible:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.15)]",
        isDragging && "cursor-grabbing opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span>{task.id}</span>
        <AgentDot attach={{ kind: "task", id: task.id }} />
        <span className="flex-1" />
        {task.due && !done && <span title="Due">{task.due.slice(5)}</span>}
        {size && <span title={task.size} className="rounded-sm bg-surface2 px-1 text-[10px]">{size}</span>}
      </div>

      <p className={cn("mt-1 line-clamp-2 text-[13px] font-medium leading-snug", done ? "text-muted" : "text-txt")}>{task.title}</p>

      {(epic || sentBack?.outcome === "changes requested" || task.manualTests) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {epic && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-muted" title={task.phase}>
              {epic.id && <span className="font-mono text-[10px]">{epic.id}</span>}
              <span className="truncate">{epic.title}</span>
            </span>
          )}
          {sentBack?.outcome === "changes requested" && (
            <span
              title={sentBack.note}
              className="inline-flex items-center gap-1 rounded-sm border border-amber/40 bg-amber/5 px-1.5 py-0.5 text-[10px] text-amber"
            >
              <CornerUpLeft className="size-3" aria-hidden /> changes requested
            </span>
          )}
          {task.manualTests && (
            <Link
              href={`/manual-tests#${task.id}`}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              title={`Manual tests: ${task.manualTests.done} of ${task.manualTests.total} ticked`}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-accent/50",
                task.manualTests.done === task.manualTests.total ? "border-teal/30 bg-teal/5 text-teal" : "border-border text-muted",
              )}
            >
              <FlaskConical className="size-3" aria-hidden />
              {task.manualTests.done}/{task.manualTests.total}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
