"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Task } from "@/types"

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted border-border2",
  "in-progress": "text-amber border-amber/30 bg-amber/5",
  blocked: "text-danger border-danger/30 bg-danger/5",
  done: "text-teal border-teal/30 bg-teal/5",
  cancelled: "text-muted border-border line-through",
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  todo: "border-border2 text-muted",
  "in-progress": "border-amber/40 text-amber",
  blocked: "border-danger/40 text-danger",
  done: "border-teal/40 text-teal",
  cancelled: "border-border text-muted",
}

export const STATUS_ICONS: Record<string, string> = {
  todo: "📋",
  "in-progress": "🔨",
  blocked: "🚫",
  done: "✅",
  cancelled: "❌",
}

const NEXT_STATUS: Record<string, string[]> = {
  todo: ["in-progress"],
  "in-progress": ["done", "blocked", "todo"],
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
      className={cn(
        "group relative bg-surface border rounded-lg p-3 text-sm transition-all hover:border-border2",
        STATUS_COLORS[task.status] || "border-border",
        isDragging && "opacity-50 cursor-grabbing",
      )}
    >
      {/* ID + status badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-muted">{task.id}</span>
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
