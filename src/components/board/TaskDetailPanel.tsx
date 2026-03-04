"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
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

export function TaskDetailPanel({ task, onClose, onMove }: TaskDetailPanelProps) {
  useEffect(() => {
    if (!task) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [task, onClose])

  if (!task) return null

  const nextStatuses = NEXT_STATUS[task.status] || []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] z-50 bg-surface border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted">{task.id}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded border font-mono", STATUS_COLORS[task.status])}>
                {STATUS_ICONS[task.status]} {task.status}
              </span>
            </div>
            <p className="font-medium text-txt text-sm leading-snug">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 text-muted hover:text-txt transition-colors text-lg leading-none"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Quick actions */}
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => { onMove(task.id, s); onClose() }}
                className="text-xs px-2.5 py-1 rounded bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
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
      </div>
    </>
  )
}
