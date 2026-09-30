"use client"

import { displayStatus } from "@/lib/statuses"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Link2Off } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { StatusChip, StatusIcon } from "@/components/shared/StatusIcon"
import { SegmentedProgress, StatusPill } from "@/components/roadmap/RoadmapNodes"
import { cn } from "@/lib/utils"
import type { Attach } from "@/lib/chats"
import type { RoadmapItem, Task, TaskStatus } from "@/types"
import { attachHref } from "./StatusMarker"

const KICKER = "font-mono text-[10px] uppercase tracking-widest text-muted"


/** Right column of /chat: what the chat is about (epic or task), live from the board and roadmap. */
export function ChatContextRail({ attach }: { attach: Attach | null }) {
  const { board, rootParam } = useApp()
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [reload, setReload] = useState(0)

  // Roadmap items: loaded here (the roadmap page keeps its own copy); refetched on roadmap SSE events
  useEffect(() => {
    let cancelled = false
    fetch(`/api/roadmap${rootParam}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: RoadmapItem[] }) => { if (!cancelled) setItems(d.items ?? []) })
      .catch((e) => console.warn("[vibedoc] could not load roadmap for the chat rail:", e))
    return () => { cancelled = true }
  }, [rootParam, reload])
  useEffect(() => {
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type
      if (type === "roadmap_updated" || type === "task_created") setReload((n) => n + 1)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [])

  const tasksById = useMemo(() => {
    const all = board ? Object.values(board).flat() : []
    return Object.fromEntries(all.map((t) => [t.id, t])) as Record<string, Task>
  }, [board])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div key={attach ? `${attach.kind}:${attach.id}` : "none"} className="flex flex-col gap-5 p-5 animate-fade-in">
        {!attach && <NoAttach />}
        {attach?.kind === "epic" && <EpicContext item={items.find((i) => i.id === attach.id)} id={attach.id} tasksById={tasksById} />}
        {attach?.kind === "task" && <TaskContext task={tasksById[attach.id]} id={attach.id} items={items} />}
      </div>
    </div>
  )
}

function NoAttach() {
  return (
    <>
      <p className={KICKER}>Context</p>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border2 p-4">
        <Link2Off className="size-4 text-muted" />
        <p className="text-sm text-txt">Not linked to an epic or task</p>
        <p className="text-xs leading-relaxed text-muted">
          Open a chat from an epic on the roadmap or a task on the board, and the agent starts with that item as context.
          Its status then shows on the item.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>The agent can</p>
        <ul className="flex flex-col gap-1.5 text-xs text-muted">
          <li>Read docs, tasks, the roadmap and memory</li>
          <li>Propose doc and task edits (you review a diff)</li>
          <li>Propose epics and task breakdowns (you accept)</li>
          <li className="text-muted/70">It can&apos;t run code or edit source files</li>
        </ul>
      </div>
    </>
  )
}

function EpicContext({ item, id, tasksById }: { item?: RoadmapItem; id: string; tasksById: Record<string, Task> }) {
  if (!item) return <Missing kind="Epic" id={id} />
  const tasks = item.tasks.map((t) => tasksById[t]).filter((t): t is Task => !!t)
  const statuses = tasks.map((t) => t.status).filter((s): s is TaskStatus => s !== "cancelled")
  const done = statuses.filter((s) => s === "done").length
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>Epic · {item.id}</p>
        <h3 className="text-base font-semibold leading-snug text-txt">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          {item.due && <span className="font-mono text-[10px] text-muted">due {item.due}</span>}
        </div>
      </div>

      {statuses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <p className={KICKER}>Progress</p>
            <span className="font-mono text-[10px] text-muted">{done}/{statuses.length} tasks</span>
          </div>
          <SegmentedProgress statuses={statuses} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>Tasks</p>
          <ul className="-mx-2 flex flex-col">
            {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </ul>
        </div>
      )}

      {item.body.trim() && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>Brief</p>
          <MarkdownRenderer content={item.body} className="prose-compact" />
        </div>
      )}

      <OpenLink attach={{ kind: "epic", id: item.id }} label="Open in roadmap" />
    </>
  )
}

function TaskRow({ task }: { task: Task }) {
  const { showAbout } = useChats()
  return (
    <li>
      <button
        type="button"
        onClick={() => showAbout({ kind: "task", id: task.id })}
        title={`Chat about ${task.id}`}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-(--duration-fast) hover:bg-surface2"
      >
        <StatusIcon status={displayStatus(task)} className="size-3" />
        <span className="shrink-0 font-mono text-[10px] text-muted">{task.id}</span>
        <span className={cn("min-w-0 flex-1 truncate", task.status === "done" ? "text-muted" : "text-txt")}>{task.title}</span>
      </button>
    </li>
  )
}

function TaskContext({ task, id, items }: { task?: Task; id: string; items: RoadmapItem[] }) {
  const { showAbout } = useChats()
  if (!task) return <Missing kind="Task" id={id} />
  const epicId = task.phase.match(/^R\d+/)?.[0]
  const epic = epicId ? items.find((i) => i.id === epicId) : undefined
  const body = task.raw?.replace(/^#.*\n(\*\*[^*]+:\*\*.*\n)*/, "").trim()
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>Task · {task.id}</p>
        <h3 className="text-base font-semibold leading-snug text-txt">{task.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={displayStatus(task)} />
          {task.size && <span className="font-mono text-[10px] text-muted">{task.size}</span>}
          {task.due && <span className="font-mono text-[10px] text-muted">due {task.due}</span>}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {epicId && (
          <>
            <dt className="text-muted">Epic</dt>
            <dd className="min-w-0">
              <button type="button" onClick={() => showAbout({ kind: "epic", id: epicId })} className="truncate text-left text-txt hover:text-accent" title={`Chat about ${epicId}`}>
                <span className="font-mono text-[10px] text-muted">{epicId}</span> {epic?.title ?? task.phase.replace(/^R\d+\s*—\s*/, "")}
              </button>
            </dd>
          </>
        )}
        {task.dependsOn && task.dependsOn !== "—" && (
          <>
            <dt className="text-muted">Depends on</dt>
            <dd className="font-mono text-[11px] text-txt">{task.dependsOn}</dd>
          </>
        )}
      </dl>

      {body && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>Spec</p>
          <MarkdownRenderer content={body} className="prose-compact" />
        </div>
      )}

      <OpenLink attach={{ kind: "task", id: task.id }} label="Open on board" />
    </>
  )
}

function Missing({ kind, id }: { kind: string; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={KICKER}>{kind} · {id}</p>
      <p className="text-sm text-muted">{kind} {id} isn&apos;t in this project any more.</p>
    </div>
  )
}

function OpenLink({ attach, label }: { attach: Attach; label: string }) {
  return (
    <Link
      href={attachHref(attach)}
      className="group inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-txt transition-colors duration-(--duration-fast) hover:border-accent/50 hover:text-accent"
    >
      {label}
      <ArrowUpRight className="size-3.5 transition-transform duration-(--duration-fast) group-hover:-translate-y-px group-hover:translate-x-px" />
    </Link>
  )
}
