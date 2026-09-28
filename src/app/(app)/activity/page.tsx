"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { ActivityTab } from "@/components/activity/ActivityTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"

function ActivityContent() {
  const { activity, liveIndicator, rootParam, board, moveTask, openDoc } = useApp()
  const focusSessionId = useSearchParams().get("session")
  const [taskId, setTaskId] = useState<string | null>(null)
  // Derive from the board so the panel reflects moves made while it is open
  const task = (board && taskId && Object.values(board).flat().find(t => t.id === taskId)) || null

  return (
    <div className="relative flex-1">
      <ActivityTab
        activity={activity}
        liveIndicator={liveIndicator}
        rootParam={rootParam}
        onOpenTask={setTaskId}
        onOpenDoc={openDoc}
        focusSessionId={focusSessionId}
      />
      <TaskDetailPanel task={task} onClose={() => setTaskId(null)} onMove={moveTask} />
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityContent />
    </Suspense>
  )
}
