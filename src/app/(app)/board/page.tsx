"use client"

import { useState } from "react"
import { useApp } from "@/context/AppContext"
import { BoardTab } from "@/components/board/BoardTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"
import { NewTaskModal } from "@/components/board/NewTaskModal"
import type { Task } from "@/types"

export default function BoardPage() {
  const { board, summary, moveTask, refresh, rootParam } = useApp()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  if (!board) return null

  return (
    <div className="relative flex-1">
      <BoardTab
        board={board}
        summary={summary}
        onMoveTask={moveTask}
        onOpenTask={setSelectedTask}
        onNewTask={() => setNewTaskOpen(true)}
      />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMove={moveTask}
      />
      <NewTaskModal
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        rootParam={rootParam}
        onTaskCreated={refresh}
      />
    </div>
  )
}
