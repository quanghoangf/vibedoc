"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"
import { StatusIcon, STATUS_META } from "@/components/shared/StatusIcon"
import { TaskCard } from "./TaskCard"

/** Done keeps growing forever; show the newest few and let the rest expand on demand. */
const DONE_PREVIEW = 8

interface BoardColumnProps {
  status: "in-progress" | "review" | "todo" | "blocked" | "done"
  tasks: Task[]
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
}

export function BoardColumn({ status, tasks, onMoveTask, onOpenTask }: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const list = tasks ?? []
  // Newest first for Done (highest T id), so the tasks just finished are on top
  const ordered = status === "done" ? [...list].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true })) : list
  const collapsible = status === "done" && ordered.length > DONE_PREVIEW
  const shown = collapsible && !showAll ? ordered.slice(0, DONE_PREVIEW) : ordered

  return (
    <section aria-label={STATUS_META[status].label} className="flex min-w-0 flex-col gap-2">
      <header className="flex h-7 items-center gap-2 px-0.5">
        <StatusIcon status={status} />
        <h2 className="text-xs font-medium text-txt">{STATUS_META[status].label}</h2>
        <span className="font-mono text-[11px] text-muted tabular-nums">{list.length}</span>
      </header>

      <div
        data-column={status}
        className={cn(
          "flex min-h-11 flex-col gap-2 rounded-lg transition-[background-color,box-shadow] duration-(--duration-fast)",
          isDragOver && "bg-accent/5 shadow-[0_0_0_1px_rgb(var(--rgb-accent)/0.5)]",
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const taskId = e.dataTransfer.getData("taskId")
          if (taskId) onMoveTask(taskId, status)
        }}
      >
        {shown.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={() => onOpenTask(task)} />
        ))}
        {list.length === 0 && (
          <div className="grid h-11 place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted/70">
            Drop a task here
          </div>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md py-1.5 text-xs text-muted transition-colors hover:bg-surface2 hover:text-txt"
          >
            {showAll ? "Show fewer" : `Show all ${ordered.length}`}
          </button>
        )}
      </div>
    </section>
  )
}
