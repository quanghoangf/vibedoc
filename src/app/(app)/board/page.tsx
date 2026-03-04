"use client"

import { useState } from "react"
import { useApp } from "@/context/AppContext"
import { BoardTab } from "@/components/board/BoardTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"
import type { Task } from "@/types"

export default function BoardPage() {
  const { board, summary, moveTask } = useApp()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  if (!board) return null

  return (
    <div className="relative flex-1">
      <BoardTab
        board={board}
        summary={summary}
        onMoveTask={moveTask}
        onOpenTask={setSelectedTask}
      />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMove={moveTask}
      />
    </div>
  )
}
