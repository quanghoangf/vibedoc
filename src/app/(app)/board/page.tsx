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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // ?task=T055 (links from a chat) opens that task; adjusted during render so a new link re-opens it
  const taskParam = useSearchParams().get("task")
  const [seenTaskParam, setSeenTaskParam] = useState<string | null>(null)
  if (board && taskParam !== seenTaskParam) {
    setSeenTaskParam(taskParam)
    if (taskParam && Object.values(board).flat().some((t) => t.id === taskParam)) setSelectedId(taskParam)
  }
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  // Drop only ?task=: the rest of the query is the live board view
  const closeTaskParam = () => {
    const p = new URLSearchParams(window.location.search)
    p.delete("task")
    router.replace(p.size ? `/board?${p}` : "/board", { scroll: false })
  }

  const tasks = useMemo(() => (board ? Object.values(board).flat() : []), [board])
  // derived from the board so edits show live and a deleted task closes the panel
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null

  if (!board) return null

  return (
    <div className="relative min-w-0 flex-1">
      <BoardTab
        tasks={tasks}
        onMoveTask={moveTask}
        onOpenTask={(t: Task) => setSelectedId(t.id)}
        onNewTask={() => setNewTaskOpen(true)}
      />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => { setSelectedId(null); if (taskParam) closeTaskParam() }}
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
