"use client"

import type { TaskBoard, Task, Summary } from "@/types"
import { BoardColumn } from "./BoardColumn"

interface BoardTabProps {
  board: TaskBoard
  summary: Summary | null
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
}

export function BoardTab({ board, summary, onMoveTask, onOpenTask }: BoardTabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl">Task Board</h1>
        <span className="text-xs font-mono text-muted">{summary?.tasks.total || 0} tasks</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(["in-progress", "todo", "blocked", "done"] as const).map((col) => (
          <BoardColumn
            key={col}
            status={col}
            tasks={board[col]}
            onMoveTask={onMoveTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  )
}
