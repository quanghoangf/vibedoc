"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { BoardTab } from "@/components/board/BoardTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"
import { NewTaskModal } from "@/components/board/NewTaskModal"
import type { Task } from "@/types"

export default function BoardPage() {
  return (
    <Suspense>
      <BoardPageInner />
    </Suspense>
  )
}

function BoardPageInner() {
  const { board, summary, moveTask, refresh, rootParam } = useApp()
  const router = useRouter()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  // ?task=T055 (links from a chat) opens that task; adjusted during render so a new link re-opens it
  const taskParam = useSearchParams().get("task")
  const [seenTaskParam, setSeenTaskParam] = useState<string | null>(null)
  if (board && taskParam !== seenTaskParam) {
    setSeenTaskParam(taskParam)
    const found = taskParam ? Object.values(board).flat().find((t) => t.id === taskParam) : undefined
    if (found) setSelectedTask(found)
  }
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
        onClose={() => { setSelectedTask(null); if (taskParam) router.replace("/board", { scroll: false }) }}
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
