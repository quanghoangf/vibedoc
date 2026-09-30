"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types"
import { groupTasks, type PropertyKey, type TaskGroup, type ViewState } from "@/lib/board-views"
import { StatusIcon, STATUS_META } from "@/components/shared/StatusIcon"
import { TaskCard } from "../TaskCard"

export interface ViewProps {
  tasks: Task[]
  allTasks: Task[]
  state: ViewState
  agentTasks: Set<string>
  onOpenTask: (task: Task) => void
  selected?: Set<string>
  /** Toggle (or with `on`, set) selection for these ids */
  onToggleSelect?: (ids: string[], on?: boolean) => void
}

type Column = "todo" | "in-progress" | "review" | "blocked" | "done"
/** Review is optional: a task can wait there for a human, but nothing has to pass through it. */
const COLUMNS: Column[] = ["todo", "in-progress", "review", "blocked", "done"]
/** Mobile stacks sections by urgency instead. */
const MOBILE_ORDER: Column[] = ["in-progress", "review", "todo", "blocked", "done"]
/** Newest done IDs shown in the collapsed Done column. */
const DONE_IDS = 5
/** Fully done lanes shown before "+ N more … all done". */
const DONE_LANES = 4

/** One 4px mark per task, in its status hue (same as the Manual tests / Activity marks). */
const MARK: Record<TaskStatus, string> = {
  todo: "bg-border2",
  "in-progress": "bg-amber",
  review: "bg-accent",
  blocked: "bg-danger",
  done: "bg-teal",
  cancelled: "bg-border",
}

const isDone = (t: Task) => t.status === "done" || t.status === "cancelled"
const newestFirst = (a: Task, b: Task) => b.id.localeCompare(a.id, undefined, { numeric: true })
/** Cancelled tasks (shown only when a status filter names them) sit in Done, matching the lane tallies. */
const inColumn = (tasks: Task[], col: Column) => tasks.filter((t) => (col === "done" ? isDone(t) : t.status === col))

export function BoardView({ tasks, state, onOpenTask, onMoveTask, selected, onToggleSelect }: ViewProps & { onMoveTask: (id: string, status: string) => void }) {
  const [doneOpen, setDoneOpen] = useState(false)
  const [laneOpen, setLaneOpen] = useState<Record<string, boolean>>({})
  const [showAllDoneLanes, setShowAllDoneLanes] = useState(false)
  // Empty lane cells are drop targets; they only draw a box while a card is being dragged
  const [dragging, setDragging] = useState(false)

  if (tasks.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed border-border px-4 py-12 text-center">
        <p className="text-sm font-medium text-txt">No tasks match these filters.</p>
        <p className="mt-1 text-xs text-muted">Remove a filter or clear the search to see more.</p>
      </div>
    )
  }

  const lanes: TaskGroup[] | null = state.subGroup === "none" ? null : groupTasks(tasks, state.subGroup)
  // A card inside an epic lane doesn't repeat the epic
  const properties: PropertyKey[] = state.subGroup === "epic" ? state.properties.filter((p) => p !== "epic") : state.properties
  const card = (t: Task) => (
    <TaskCard
      key={t.id}
      task={t}
      properties={properties}
      onOpen={() => onOpenTask(t)}
      selected={selected?.has(t.id)}
      onSelect={onToggleSelect && (() => onToggleSelect([t.id]))}
    />
  )
  // Lanes with open work first, then fully done ones (collapsed, capped)
  const openLanes = lanes?.filter((l) => !l.tasks.every(isDone)) ?? []
  const doneLanes = lanes?.filter((l) => l.tasks.every(isDone)) ?? []
  const hiddenDoneLanes = showAllDoneLanes ? 0 : Math.max(0, doneLanes.length - DONE_LANES)
  const shownLanes = [...openLanes, ...doneLanes.slice(0, doneLanes.length - hiddenDoneLanes)]
  const laneNoun = state.subGroup === "epic" ? "epics" : "sizes"
  // Done cards always sit in the Done column: it widens when opened, or when you open a finished lane to see its cards
  const doneWide = doneOpen || doneLanes.some((l) => laneOpen[l.key])
  const toggleDone = () => {
    if (doneWide) { setDoneOpen(false); setLaneOpen((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !doneLanes.some((l) => l.key === k)))) }
    else setDoneOpen(true)
  }
  const grid = doneWide ? "md:grid-cols-5" : "md:grid-cols-[repeat(4,minmax(0,1fr))_140px]"

  const cells = (list: Task[], compact: boolean) =>
    COLUMNS.map((col) => {
      const colTasks = inColumn(list, col)
      return (
        <DropCell key={col} status={col} onMoveTask={onMoveTask}>
          {col === "done" && !doneWide ? (
            <DoneSummary tasks={colTasks} compact={compact} dragging={dragging} onOpenTask={onOpenTask} />
          ) : colTasks.length ? (
            (col === "done" ? [...colTasks].sort(newestFirst) : colTasks).map(card)
          ) : compact && !dragging ? null : (
            <div className="grid h-11 place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted/70">
              {compact ? "" : "Drop a task here"}
            </div>
          )}
        </DropCell>
      )
    })

  return (
    <>
      {/* Desktop: status columns, optionally split into swimlanes */}
      <div className="hidden md:block" onDragStartCapture={() => setDragging(true)} onDragEndCapture={() => setDragging(false)}>
        <div className={cn("grid gap-3 border-b border-border", grid, lanes && "pl-7.5")}>
          {COLUMNS.map((col) => (
            // The header is a drop target too, so a card can always reach every status (even when all lanes are done)
            <DropCell key={col} status={col} onMoveTask={onMoveTask} header>
            <div className="flex min-w-0 items-center gap-1.5 px-0.5 pb-2 text-xs font-semibold text-txt">
              <StatusIcon status={col} />
              <h2 className="truncate">{STATUS_META[col].label}</h2>
              <span className="font-mono font-normal text-muted tabular-nums">{inColumn(tasks, col).length}</span>
              {col === "done" && (
                <>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={toggleDone}
                    aria-expanded={doneWide}
                    aria-label={doneWide ? "Collapse Done" : "Expand Done"}
                    className="-my-1 grid size-6 place-items-center rounded-md text-muted outline-hidden transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform duration-(--duration-base) ease-out-soft", doneWide && "rotate-180")} aria-hidden />
                  </button>
                </>
              )}
            </div>
            </DropCell>
          ))}
        </div>

        {!lanes ? (
          <div className={cn("grid gap-3 pt-3", grid)}>{cells(tasks, false)}</div>
        ) : (
          <>
            {shownLanes.map((lane) => {
              const allDone = lane.tasks.every(isDone)
              const open = laneOpen[lane.key] ?? !allDone
              const doneCount = lane.tasks.filter(isDone).length
              return (
                <section key={lane.key} aria-label={lane.epicId ? `${lane.epicId} ${lane.label}` : lane.label}>
                  <button
                    type="button"
                    onClick={() => setLaneOpen((m) => ({ ...m, [lane.key]: !open }))}
                    aria-expanded={open}
                    className="mt-1.5 flex h-8.5 w-full items-center gap-2.5 rounded-md px-1.5 text-left outline-hidden transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    {open ? <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />}
                    {lane.epicId && <span className="font-mono text-[11px] text-muted">{lane.epicId}</span>}
                    <span className="min-w-0 truncate text-[13px] font-semibold text-txt">{lane.label}</span>
                    <span className="flex w-30 shrink-0 gap-0.5" aria-hidden>
                      {lane.tasks.map((t) => <span key={t.id} className={cn("h-1 flex-1 rounded-full", MARK[t.status])} />)}
                    </span>
                    <span className="font-mono text-[11px] text-muted tabular-nums" aria-label={`${doneCount} of ${lane.tasks.length} done`}>
                      <span className="text-txt">{doneCount}</span>/{lane.tasks.length}
                    </span>
                    {allDone && <span className="text-xs text-muted">all done</span>}
                  </button>
                  <div className={cn("grid transition-[grid-template-rows,opacity] duration-(--duration-base) ease-out-soft", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <div className="min-h-0 overflow-hidden" inert={!open}>
                      <div className={cn("grid gap-3 pt-2 pb-1 pl-7.5", grid)}>{cells(lane.tasks, true)}</div>
                    </div>
                  </div>
                </section>
              )
            })}
            {hiddenDoneLanes > 0 && (
              <p className="mt-2 ml-9 text-xs text-muted">
                + <span className="font-mono">{hiddenDoneLanes}</span> more {laneNoun}, all done ·{" "}
                <button
                  type="button"
                  onClick={() => setShowAllDoneLanes(true)}
                  className="rounded-sm text-txt underline decoration-accent underline-offset-2 outline-hidden hover:decoration-txt focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Show
                </button>
              </p>
            )}
          </>
        )}
      </div>

      {/* Mobile: stacked status sections, no columns */}
      <div className="md:hidden">
        {tasks.every(isDone) && <p className="mt-3.5 text-sm text-muted">Nothing open. Every task here is done.</p>}
        {MOBILE_ORDER.map((col) => {
          const colTasks = inColumn(tasks, col)
          if (!colTasks.length) return null
          const collapsed = col === "done" && !doneOpen
          return (
            <section key={col} aria-label={STATUS_META[col].label}>
              <h2 className="mt-3.5 mb-2 flex items-center gap-1.5 text-xs font-semibold text-txt">
                <StatusIcon status={col} />
                {STATUS_META[col].label}
                <span className="font-mono font-normal text-muted tabular-nums">{colTasks.length}</span>
                <span className="h-px flex-1 bg-border" />
                {col === "done" && (
                  <button
                    type="button"
                    onClick={() => setDoneOpen((v) => !v)}
                    aria-expanded={doneOpen}
                    className="min-h-11 rounded-md px-2 text-xs font-normal text-muted outline-hidden hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    {doneOpen ? "Hide" : "Show"}
                  </button>
                )}
              </h2>
              {!collapsed && <div className="flex flex-col gap-2">{(col === "done" ? [...colTasks].sort(newestFirst) : colTasks).map(card)}</div>}
            </section>
          )
        })}
      </div>
    </>
  )
}

/** A drop target for one status (a whole column, or one lane's slice of it). Dropping only changes status. */
function DropCell({ status, onMoveTask, header = false, children }: { status: Column; onMoveTask: (id: string, status: string) => void; header?: boolean; children: ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div
      data-column={header ? undefined : status}
      data-column-header={header ? status : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg",
        !header && "min-h-11",
        "transition-[background-color,box-shadow] duration-(--duration-fast)",
        over && "bg-accent/5 shadow-[0_0_0_1px_rgb(var(--rgb-accent)/0.5)]",
      )}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const taskId = e.dataTransfer.getData("taskId")
        if (taskId) onMoveTask(taskId, status)
      }}
    >
      {children}
    </div>
  )
}

/** Collapsed Done: the count and the newest few IDs (each opens its task). */
function DoneSummary({ tasks, compact, dragging, onOpenTask }: { tasks: Task[]; compact: boolean; dragging: boolean; onOpenTask: (task: Task) => void }) {
  if (!tasks.length) {
    if (compact && !dragging) return null
    return <div className="grid h-11 place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted/70">{compact ? "" : "Drop here"}</div>
  }
  const newest = [...tasks].sort(newestFirst).slice(0, DONE_IDS)
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border2 px-2 py-1.5 text-[11px] text-muted">
      <span className="flex flex-wrap gap-x-1.5 font-mono">
        {newest.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTask(t)}
            title={t.title}
            className="rounded-sm text-txt outline-hidden hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {t.id}
          </button>
        ))}
      </span>
      <span><span className="font-mono">{tasks.length}</span> done</span>
    </div>
  )
}
