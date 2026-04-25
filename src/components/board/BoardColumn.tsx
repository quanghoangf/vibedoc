"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/types"
import { TaskCard, STATUS_ICONS } from "./TaskCard"

interface BoardColumnProps {
  status: "in-progress" | "todo" | "blocked" | "done"
  tasks: Task[]
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
}

export function BoardColumn({ status, tasks, onMoveTask, onOpenTask }: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{STATUS_ICONS[status]}</span>
        <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">
          {status}
        </span>
        <Badge variant="secondary" className="ml-auto font-mono text-xs h-5 px-1.5">{tasks.length}</Badge>
      </div>

      {/* Task cards */}
      <div
        className={cn(
          "flex flex-col gap-2 min-h-[60px] rounded-lg transition-colors",
          isDragOver && "ring-1 ring-accent/50 bg-accent/5",
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const taskId = e.dataTransfer.getData("taskId")
          if (taskId) onMoveTask(taskId, status)
        }}
      >
        {(tasks ?? []).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onMove={onMoveTask}
            onOpen={() => onOpenTask(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="border border-dashed border-border rounded-lg py-6 text-center text-xs text-muted">
            empty
          </div>
        )}
      </div>
    </div>
  )
}
