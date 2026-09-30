"use client"

import { useState } from "react"
import Link from "next/link"
import { CornerDownRight, CornerUpLeft, FlaskConical, MoreHorizontal, PanelRightOpen, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApp } from "@/context/AppContext"
import { deleteTaskWithUndo } from "./task-api"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"
import { AgentDot } from "@/components/chat/AgentMark"
import { latestReview } from "@/lib/review"
import { epicOf, sizeOf, type PropertyKey } from "@/lib/board-views"

const ALL_PROPERTIES: PropertyKey[] = ["status", "epic", "size", "due", "deps", "tests", "agent"]

interface TaskCardProps {
  task: Task
  onOpen: () => void
  /** Which lines show; defaults to every property. */
  properties?: PropertyKey[]
}

/**
 * A task on the board. The column already says the status, so the card doesn't repeat it.
 * Click (or Enter) opens the task panel, where every action lives; drag moves it between columns.
 */
export function TaskCard({ task, onOpen, properties = ALL_PROPERTIES }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const show = (p: PropertyKey) => properties.includes(p)
  const epic = show("epic") && task.phase ? epicOf(task.phase) : null
  const sentBack = task.status === "todo" && task.raw ? latestReview(task.raw) : null
  const size = show("size") ? sizeOf(task) : null
  const done = task.status === "done" || task.status === "cancelled"
  const deps = show("deps") ? task.dependsOn.match(/\bT\d+\b/g) ?? [] : []
  const tests = show("tests") ? task.manualTests : null
  const changesRequested = sentBack?.outcome === "changes requested"

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`${task.id} ${task.title}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id)
        e.dataTransfer.effectAllowed = "move"
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{ viewTransitionName: `task-${task.file.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-left outline-hidden",
        "transition-[border-color,background-color,opacity,box-shadow] duration-(--duration-fast)",
        "hover:border-border2 hover:bg-surface2/50 focus-visible:border-accent/60 focus-visible:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.15)]",
        isDragging && "cursor-grabbing opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span>{task.id}</span>
        {show("agent") && <AgentDot attach={{ kind: "task", id: task.id }} />}
        <span className="flex-1" />
        {show("due") && task.due && !done && <span title="Due">{task.due.slice(5)}</span>}
        {size && <span title={task.size} className="rounded-sm bg-surface2 px-1 text-[10px]">{size}</span>}
        <CardMenu task={task} onOpen={onOpen} />
      </div>

      <p className={cn("mt-1 line-clamp-2 text-[13px] font-medium leading-snug", done ? "text-muted" : "text-txt")}>{task.title}</p>

      {(epic || changesRequested || deps.length > 0 || tests) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {epic && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-muted" title={task.phase}>
              {epic.id && <span className="font-mono text-[10px]">{epic.id}</span>}
              <span className="truncate">{epic.title}</span>
            </span>
          )}
          {changesRequested && (
            <span
              title={sentBack?.note}
              className="inline-flex items-center gap-1 rounded-sm border border-amber/40 bg-amber/5 px-1.5 py-0.5 text-[10px] text-amber"
            >
              <CornerUpLeft className="size-3" aria-hidden /> changes requested
            </span>
          )}
          {deps.length > 0 && (
            <span title={`Depends on ${deps.join(", ")}`} className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
              <CornerDownRight className="size-3" aria-label="Depends on" />
              {deps.join(", ")}
            </span>
          )}
          {tests && (
            <Link
              href={`/manual-tests#${task.id}`}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              title={`Manual tests: ${tests.done} of ${tests.total} ticked`}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-accent/50",
                tests.done === tests.total ? "border-teal/30 bg-teal/5 text-teal" : "border-border text-muted",
              )}
            >
              <FlaskConical className="size-3" aria-hidden />
              {tests.done}/{tests.total}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** ⋯ on the card (on hover / focus). Events are stopped so the card doesn't open or drag underneath. */
function CardMenu({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { rootParam } = useApp()
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          draggable={false}
          aria-label={`Actions for ${task.id}`}
          onClick={stop}
          onKeyDown={stop}
          className="-my-1 -mr-1 grid size-5 place-items-center rounded-sm text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-txt focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      {/* React events bubble through the portal to the card: stop them here */}
      <DropdownMenuContent align="end" className="w-40" onClick={stop} onKeyDown={stop}>
        <DropdownMenuItem onSelect={onOpen}><PanelRightOpen /> Open</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => { deleteTaskWithUndo(task, rootParam).catch((e: Error) => toast(e.message)) }}
          className="text-danger focus:text-danger"
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
