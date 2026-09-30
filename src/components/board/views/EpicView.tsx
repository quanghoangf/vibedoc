"use client"

import { useMemo, useState } from "react"
import { Bot, ChevronRight, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types"
import { depOutline, groupTasks, isReady, sizeOf, type TaskGroup, type ViewState } from "@/lib/board-views"
import { STATUS_META, StatusIcon } from "@/components/shared/StatusIcon"

interface ViewProps {
  tasks: Task[]
  allTasks: Task[]
  state: ViewState
  agentTasks: Set<string>
  onOpenTask: (task: Task) => void
}

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
/** Collapsed all-done epics shown before "+ N more". */
const DONE_SHOWN = 3
const UP_NEXT_MAX = 5

const MARK_BG: Record<TaskStatus, string> = {
  todo: "bg-border2",
  "in-progress": "bg-amber",
  review: "bg-accent",
  blocked: "bg-danger",
  done: "bg-teal",
  cancelled: "bg-border2",
}

const idNum = (id: string) => parseInt(id.replace(/\D/g, ""), 10) || 0
const byId = (a: Task, b: Task) => idNum(a.id) - idNum(b.id)
const depIds = (t: Task) => t.dependsOn.match(/T\d+/g) ?? []

function epicStatus(tasks: Task[]): TaskStatus {
  if (tasks.some(t => t.status === "in-progress" || t.status === "review")) return "in-progress"
  const open = tasks.filter(t => t.status !== "done" && t.status !== "cancelled")
  if (open.length > 0 && open.every(t => t.status === "blocked")) return "blocked"
  if (tasks.length > 0 && tasks.every(t => t.status === "done")) return "done"
  return "todo"
}

export function EpicView({ tasks, allTasks, agentTasks, onOpenTask }: ViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAllDone, setShowAllDone] = useState(false)

  const taskMap = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks])
  const groups = useMemo(() => groupTasks(tasks, "epic"), [tasks])

  // vibedoc_next_task order: epic order, then ID.
  const { firstReady, upNext } = useMemo(() => {
    const firstReady = new Set<string>()
    const ready: Task[] = []
    const waiting: { task: Task; on: string }[] = []
    for (const g of groups) {
      const sorted = [...g.tasks].sort(byId)
      const r = sorted.filter(t => isReady(t, taskMap))
      if (r[0]) firstReady.add(r[0].id)
      ready.push(...r)
      for (const t of sorted) {
        if (t.status !== "todo" && t.status !== "blocked") continue
        const open = depIds(t).filter(id => taskMap.get(id)?.status !== "done")
        if (open.length === 1) waiting.push({ task: t, on: open[0] })
      }
    }
    const upNext = [
      ...ready.map(task => ({ task, on: null as string | null })),
      ...waiting,
    ].slice(0, UP_NEXT_MAX)
    return { firstReady, upNext }
  }, [groups, taskMap])

  if (tasks.length === 0) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-sm font-medium text-txt">No tasks match these filters.</p>
        <p className="mt-1 text-xs text-muted">Clear a filter or the search to see more epics.</p>
      </div>
    )
  }

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  let doneSeen = 0
  const hidden: TaskGroup[] = []
  const sections = groups.map(g => {
    const status = epicStatus(g.tasks)
    if (status === "done" && !expanded.has(g.key)) {
      doneSeen++
      if (doneSeen > DONE_SHOWN && !showAllDone) {
        hidden.push(g)
        return null
      }
      return <DoneLine key={g.key} group={g} onExpand={() => toggle(g.key)} />
    }
    return (
      <EpicSection
        key={g.key}
        group={g}
        status={status}
        collapsible={status === "done"}
        onCollapse={() => toggle(g.key)}
        firstReady={firstReady}
        agentTasks={agentTasks}
        onOpenTask={onOpenTask}
      />
    )
  })

  return (
    <div className="grid gap-6 px-4 pt-[18px] pb-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        {sections}
        {hidden.length > 0 && (
          <p className="mx-0.5 text-xs text-muted">
            + <span className="font-mono">{hidden.slice(0, 3).map(g => g.epicId ?? g.label).join(", ")}</span>
            {hidden.length > 3 && <> and <span className="font-mono">{hidden.length - 3}</span> more</>}, all done ·{" "}
            <button type="button" onClick={() => setShowAllDone(true)} className={cn("rounded-sm text-txt underline decoration-accent underline-offset-2 hover:decoration-txt", RING)}>
              Show
            </button>
          </p>
        )}
      </div>

      <aside aria-label="Up next" className="flex flex-col gap-2.5 lg:pt-1">
        <p className="text-xs font-semibold text-txt">Up next</p>
        {upNext.length === 0 && <p className="text-xs text-muted">Nothing is ready right now.</p>}
        {upNext.map(({ task, on }) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask(task)}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-[11px] py-[9px] text-left transition-colors duration-(--duration-fast) ease-out-soft hover:border-border2",
              on && "opacity-90",
              RING,
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-xs", on ? "text-muted" : "text-txt")}>
              <StatusIcon status={task.status} />
              <span className="font-mono text-[11px] text-muted">{task.id}</span>
              {on ? <>Waiting on <span className="font-mono">{on}</span></> : "Ready"}
            </span>
            <span className="text-[13px] font-medium text-txt">{task.title}</span>
          </button>
        ))}
        <p className="mt-1.5 text-[11px] leading-normal text-muted">
          Same order as <span className="font-mono">vibedoc_next_task</span>: a task is ready when everything it depends on is done.
        </p>
      </aside>
    </div>
  )
}

function Progress({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter(t => t.status === "done").length
  return (
    <span className="shrink-0 font-mono text-[11px] text-muted">
      <span className="text-txt">{done}</span>/{tasks.length}
    </span>
  )
}

function DoneLine({ group, onExpand }: { group: TaskGroup; onExpand: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={onExpand}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg border border-border bg-surface px-4 text-left transition-colors duration-(--duration-fast) ease-out-soft hover:bg-surface2",
        RING,
      )}
    >
      <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />
      {group.epicId && <span className="font-mono text-[11px] text-muted">{group.epicId}</span>}
      <span className="min-w-0 truncate text-sm font-medium text-muted">{group.label}</span>
      <span className="flex-1" />
      <StatusIcon status="done" />
      <Progress tasks={group.tasks} />
    </button>
  )
}

function EpicSection({
  group, status, collapsible, onCollapse, firstReady, agentTasks, onOpenTask,
}: {
  group: TaskGroup
  status: TaskStatus
  collapsible: boolean
  onCollapse: () => void
  firstReady: Set<string>
  agentTasks: Set<string>
  onOpenTask: (task: Task) => void
}) {
  const outline = useMemo(() => depOutline(group.tasks), [group.tasks])
  const meta = STATUS_META[status]
  const marks = [...group.tasks].sort(byId)

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface px-3.5 pt-3.5 pb-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5">
        {group.epicId && <span className="font-mono text-[11px] text-muted">{group.epicId}</span>}
        <h2 className="m-0 min-w-0 text-[1.1rem] font-semibold text-txt">{group.label}</h2>
        <span className={cn("inline-flex items-center gap-1.5 self-center text-xs", meta.text)}>
          <StatusIcon status={status} />
          {meta.label}
        </span>
        <span className="flex-1" />
        <Progress tasks={group.tasks} />
        {collapsible && (
          <button
            type="button"
            aria-expanded
            onClick={onCollapse}
            className={cn("self-center rounded-sm text-xs text-muted hover:text-txt", RING)}
          >
            Collapse
          </button>
        )}
      </div>

      <div className="flex gap-[3px] px-0.5" aria-hidden>
        {marks.map(t => (
          <span key={t.id} className={cn("h-[5px] flex-1 rounded-full", MARK_BG[t.status])} />
        ))}
      </div>

      <ul className="flex flex-col">
        {outline.map(({ task, depth, alsoAfter }) => {
          const done = task.status === "done"
          const size = sizeOf(task)
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpenTask(task)}
                style={{ paddingLeft: 16 + depth * 26 }}
                className={cn(
                  "relative flex h-[38px] w-full items-center gap-2.5 rounded-md pr-3 text-left transition-colors duration-(--duration-fast) ease-out-soft hover:bg-surface2",
                  RING,
                )}
              >
                {depth > 0 && (
                  <span
                    aria-hidden
                    style={{ left: 2 + depth * 26 }}
                    className="absolute top-0 bottom-1/2 w-2.5 rounded-bl-md border-b border-l border-border2"
                  />
                )}
                <StatusIcon status={task.status} />
                <span className="font-mono text-[11px] text-muted">{task.id}</span>
                <span className={cn("min-w-0 truncate text-[13.5px] font-medium", done ? "text-muted" : "text-txt")}>
                  {task.title}
                </span>
                {alsoAfter.length > 0 && (
                  <span className="hidden shrink-0 font-mono text-[10px] text-muted sm:inline">
                    also after {alsoAfter.join(", ")}
                  </span>
                )}
                {firstReady.has(task.id) && (
                  <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-accent px-[7px] text-[11px] text-txt">
                    <Play className="size-2.5 text-accent" aria-hidden />
                    Ready · next for the agent
                  </span>
                )}
                {agentTasks.has(task.id) && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-txt">
                    <Bot className="size-3 text-accent" aria-hidden />
                    working
                  </span>
                )}
                <span className="flex-1" />
                {size && <span className="font-mono text-[10px] text-muted">{size}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
