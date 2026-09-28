"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import type { Task } from "@/types"
import { STATUS_ICONS } from "./TaskCard"

const NEXT_STATUS: Record<string, string[]> = {
  todo: ["in-progress"],
  "in-progress": ["done", "blocked", "todo"],
  blocked: ["in-progress", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
}

const STATUS_LABELS: Record<string, string> = {
  "in-progress": "start",
  done: "done",
  blocked: "blocked",
  todo: "backlog",
  cancelled: "cancel",
}

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted border-border2",
  "in-progress": "text-amber border-amber/30 bg-amber/5",
  blocked: "text-danger border-danger/30 bg-danger/5",
  done: "text-teal border-teal/30 bg-teal/5",
  cancelled: "text-muted border-border",
}

interface TaskDetailPanelProps {
  task: Task | null
  onClose: () => void
  onMove: (id: string, status: string) => void
}

export function TaskDetailPanel({ task: openTask, onClose, onMove }: TaskDetailPanelProps) {
  // Keep the last task rendered while the sheet slides out
  const [task, setTask] = useState(openTask)
  if (openTask && openTask !== task) setTask(openTask)

  const nextStatuses = task ? NEXT_STATUS[task.status] || [] : []

  return (
    <Sheet open={!!openTask} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" aria-describedby={undefined} className="p-0 gap-0 sm:max-w-[420px] border-border flex flex-col">
        {task && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-1 min-w-0 pl-5 pr-12 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">{task.id}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded-sm border font-mono", STATUS_COLORS[task.status])}>
                  {STATUS_ICONS[task.status]} {task.status}
                </span>
              </div>
              <SheetTitle className="font-medium text-txt text-sm leading-snug">{task.title}</SheetTitle>
            </div>

            {/* Quick actions */}
            {nextStatuses.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onMove(task.id, s); onClose() }}
                    className="text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
                  >
                    {STATUS_ICONS[s]} {STATUS_LABELS[s] || s}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {task.raw ? (
                <MarkdownRenderer content={task.raw} />
              ) : (
                <p className="text-sm text-muted">No content available.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
