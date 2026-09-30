"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Task } from "@/types"
import { AgentDot } from "@/components/chat/AgentMark"
import Link from "next/link"
import { latestReview } from "@/lib/review"

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted border-border2",
  "in-progress": "text-amber border-amber/30 bg-amber/5",
  review: "text-accent border-accent/30 bg-accent/5",
  blocked: "text-danger border-danger/30 bg-danger/5",
  done: "text-teal border-teal/30 bg-teal/5",
  cancelled: "text-muted border-border line-through",
}

export const STATUS_BADGE_COLORS: Record<string, string> = {
  todo: "border-border2 text-muted",
  "in-progress": "border-amber/40 text-amber",
  review: "border-accent/40 text-accent",
  blocked: "border-danger/40 text-danger",
  done: "border-teal/40 text-teal",
  cancelled: "border-border text-muted",
}

export const STATUS_ICONS: Record<string, string> = {
  todo: "📋",
  "in-progress": "🔨",
  review: "👀",
  blocked: "🚫",
  done: "✅",
  cancelled: "❌",
}

const NEXT_STATUS: Record<string, string[]> = {
  todo: ["in-progress"],
  "in-progress": ["done", "review", "blocked", "todo"],
  review: ["done", "in-progress"],
  blocked: ["in-progress", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
}

interface TaskCardProps {
  task: Task
  onMove: (id: string, status: string) => void
  onOpen: () => void
}

export function TaskCard({ task, onMove, onOpen }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const nextStatuses = NEXT_STATUS[task.status] || []

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id)
        e.dataTransfer.effectAllowed = "move"
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{ viewTransitionName: `task-${task.file.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}
      className={cn(
        "group relative bg-surface border rounded-lg p-3 text-sm transition-[border-color,opacity] hover:border-border2",
        STATUS_COLORS[task.status] || "border-border",
        isDragging && "opacity-50 cursor-grabbing",
      )}
    >
      {/* ID + status badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-mono text-muted">{task.id}<AgentDot attach={{ kind: "task", id: task.id }} /></span>
        <Badge
          variant="outline"
          className={cn("text-[10px] h-4 px-1.5 font-normal", STATUS_BADGE_COLORS[task.status])}
        >
          {task.status === "in-progress" ? "active" : task.status}
        </Badge>
      </div>

      {/* Title */}
      <p className="font-medium text-txt text-sm leading-snug mb-2">{task.title}</p>

      {/* Phase */}
      {task.phase && <p className="text-xs text-muted mb-2">{task.phase}</p>}

      {/* Sent back from Review (R043): the reviewer's note is in the task file */}
      {task.status === "todo" && task.raw && latestReview(task.raw)?.outcome === "changes requested" && (
        <p className="mb-2 mr-1.5 inline-flex w-fit items-center gap-1 rounded-sm border border-amber/40 bg-amber/5 px-1.5 py-0.5 font-mono text-[10px] text-amber" title={latestReview(task.raw)?.note}>
          ↩ changes requested
        </p>
      )}

      {/* Manual test report (R043): what the human should click through */}
      {task.manualTests && (
        <Link
          href={`/manual-tests#${task.id}`}
          draggable={false}
          title={`Manual tests: ${task.manualTests.done} of ${task.manualTests.total} ticked`}
          className={cn(
            "mb-2 inline-flex w-fit items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-accent/50",
            task.manualTests.done === task.manualTests.total ? "border-teal/30 bg-teal/5 text-teal" : "border-border text-muted",
          )}
        >
          🧪 {task.manualTests.done}/{task.manualTests.total}
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={onOpen}
        >
          open
        </Button>
        {nextStatuses.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => onMove(task.id, s)}
          >
            {STATUS_ICONS[s]} {s === "in-progress" ? "start" : s}
          </Button>
        ))}
      </div>
    </div>
  )
}
