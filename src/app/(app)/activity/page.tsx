"use client"

import { useState } from "react"
import { useApp } from "@/context/AppContext"
import { ActivityTab } from "@/components/activity/ActivityTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"

export default function ActivityPage() {
  const { activity, liveIndicator, rootParam, board, moveTask, openDoc } = useApp()
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
      />
      <TaskDetailPanel task={task} onClose={() => setTaskId(null)} onMove={moveTask} />
    </div>
  )
}
