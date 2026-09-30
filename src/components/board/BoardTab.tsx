"use client"

import { Plus } from "lucide-react"
import type { TaskBoard, Task, Summary } from "@/types"
import { BoardColumn } from "./BoardColumn"

interface BoardTabProps {
  board: TaskBoard
  summary: Summary | null
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
  onNewTask: () => void
}

export function BoardTab({ board, summary, onMoveTask, onOpenTask, onNewTask }: BoardTabProps) {
  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Board</h1>
          <p className="mt-0.5 text-xs text-muted">
            {summary?.tasks.total || 0} tasks · drag between columns, click to open
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNewTask}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
        </div>
      </div>

      {/* Review is optional: a task can wait there for a human, but nothing has to pass through it */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {(["todo", "in-progress", "review", "blocked", "done"] as const).map((col) => (
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
