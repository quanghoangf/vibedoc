"use client"

import type { Task } from "@/types"
import { TaskCard, STATUS_ICONS } from "./TaskCard"

interface BoardColumnProps {
  status: "in-progress" | "todo" | "blocked" | "done"
  tasks: Task[]
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (file: string) => void
}

export function BoardColumn({ status, tasks, onMoveTask, onOpenTask }: BoardColumnProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{STATUS_ICONS[status]}</span>
        <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">
          {status}
        </span>
        <span className="ml-auto text-xs font-mono text-muted">{tasks.length}</span>
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-2 min-h-[60px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onMove={onMoveTask}
            onOpen={() => onOpenTask(task.file)}
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
