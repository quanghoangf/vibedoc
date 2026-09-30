"use client"

import { Suspense, useMemo, useState } from "react"
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
  const { board, moveTask, refresh, rootParam } = useApp()
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
  // Drop only ?task=: the rest of the query is the live board view
  const closeTaskParam = () => {
    const p = new URLSearchParams(window.location.search)
    p.delete("task")
    router.replace(p.size ? `/board?${p}` : "/board", { scroll: false })
  }

  const tasks = useMemo(() => (board ? Object.values(board).flat() : []), [board])

  if (!board) return null

  return (
    <div className="relative min-w-0 flex-1">
      <BoardTab
        tasks={tasks}
        onMoveTask={moveTask}
        onOpenTask={setSelectedTask}
        onNewTask={() => setNewTaskOpen(true)}
      />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => { setSelectedTask(null); if (taskParam) closeTaskParam() }}
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
