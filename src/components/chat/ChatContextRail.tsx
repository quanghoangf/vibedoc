"use client"

import { displayStatus } from "@/lib/statuses"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Link2Off } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { useT } from "@/context/LanguageContext"
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
  const { t } = useT()
  return (
    <>
      <p className={KICKER}>{t("chat.context")}</p>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border2 p-4">
        <Link2Off className="size-4 text-muted" />
        <p className="text-sm text-txt">{t("chat.notLinked")}</p>
        <p className="text-xs leading-relaxed text-muted">{t("chat.notLinkedHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>{t("chat.agentCan")}</p>
        <ul className="flex flex-col gap-1.5 text-xs text-muted">
          <li>{t("chat.canRead")}</li>
          <li>{t("chat.canEdit")}</li>
          <li>{t("chat.canPlan")}</li>
          <li className="text-muted/70">{t("chat.cannot")}</li>
        </ul>
      </div>
    </>
  )
}

function EpicContext({ item, id, tasksById }: { item?: RoadmapItem; id: string; tasksById: Record<string, Task> }) {
  const { t } = useT()
  if (!item) return <Missing kind="epic" id={id} />
  const tasks = item.tasks.map((tid) => tasksById[tid]).filter((x): x is Task => !!x)
  const statuses = tasks.map((x) => x.status).filter((s): s is TaskStatus => s !== "cancelled")
  const done = statuses.filter((s) => s === "done").length
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>{t("chat.epicKicker", { id: item.id })}</p>
        <h3 data-user-content className="text-base font-semibold leading-snug text-txt">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          {item.due && <span className="font-mono text-[10px] text-muted">{t("chat.dueDate", { date: item.due })}</span>}
        </div>
      </div>

      {statuses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <p className={KICKER}>{t("chat.progress")}</p>
            <span className="font-mono text-[10px] text-muted">{t("chat.tasksDone", { done, total: statuses.length })}</span>
          </div>
          <SegmentedProgress statuses={statuses} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>{t("chat.tasks")}</p>
          <ul className="-mx-2 flex flex-col">
            {tasks.map((x) => <TaskRow key={x.id} task={x} />)}
          </ul>
        </div>
      )}

      {item.body.trim() && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>{t("chat.brief")}</p>
          <div data-user-content><MarkdownRenderer content={item.body} className="prose-compact" /></div>
        </div>
      )}

      <OpenLink attach={{ kind: "epic", id: item.id }} label={t("chat.openInRoadmapLink")} />
    </>
  )
}

function TaskRow({ task }: { task: Task }) {
  const { showAbout } = useChats()
  const { t } = useT()
  return (
    <li>
      <button
        type="button"
        onClick={() => showAbout({ kind: "task", id: task.id })}
        title={t("chat.chatAbout", { id: task.id })}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-(--duration-fast) hover:bg-surface2"
      >
        <StatusIcon status={displayStatus(task)} className="size-3" />
        <span className="shrink-0 font-mono text-[10px] text-muted">{task.id}</span>
        <span data-user-content className={cn("min-w-0 flex-1 truncate", task.status === "done" ? "text-muted" : "text-txt")}>{task.title}</span>
      </button>
    </li>
  )
}

function TaskContext({ task, id, items }: { task?: Task; id: string; items: RoadmapItem[] }) {
  const { showAbout } = useChats()
  const { t } = useT()
  if (!task) return <Missing kind="task" id={id} />
  const epicId = task.phase.match(/^R\d+/)?.[0]
  const epic = epicId ? items.find((i) => i.id === epicId) : undefined
  const body = task.raw?.replace(/^#.*\n(\*\*[^*]+:\*\*.*\n)*/, "").trim()
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={KICKER}>{t("chat.taskKicker", { id: task.id })}</p>
        <h3 data-user-content className="text-base font-semibold leading-snug text-txt">{task.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={displayStatus(task)} />
          {task.size && <span className="font-mono text-[10px] text-muted">{task.size}</span>}
          {task.due && <span className="font-mono text-[10px] text-muted">{t("chat.dueDate", { date: task.due })}</span>}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {epicId && (
          <>
            <dt className="text-muted">{t("board.epic")}</dt>
            <dd className="min-w-0">
              <button type="button" onClick={() => showAbout({ kind: "epic", id: epicId })} className="truncate text-left text-txt hover:text-accent" title={t("chat.chatAbout", { id: epicId })}>
                <span className="font-mono text-[10px] text-muted">{epicId}</span> <span data-user-content>{epic?.title ?? task.phase.replace(/^R\d+\s*—\s*/, "")}</span>
              </button>
            </dd>
          </>
        )}
        {task.dependsOn && task.dependsOn !== "—" && (
          <>
            <dt className="text-muted">{t("board.dependsOn")}</dt>
            <dd className="font-mono text-[11px] text-txt">{task.dependsOn}</dd>
          </>
        )}
      </dl>

      {body && (
        <div className="flex flex-col gap-1.5">
          <p className={KICKER}>{t("chat.spec")}</p>
          <div data-user-content><MarkdownRenderer content={body} className="prose-compact" /></div>
        </div>
      )}

      <OpenLink attach={{ kind: "task", id: task.id }} label={t("chat.openOnBoard")} />
    </>
  )
}

function Missing({ kind, id }: { kind: "epic" | "task"; id: string }) {
  const { t } = useT()
  const label = kind === "epic" ? t("board.epic") : t("chat.task")
  return (
    <div className="flex flex-col gap-2">
      <p className={KICKER}>{t(kind === "epic" ? "chat.epicKicker" : "chat.taskKicker", { id })}</p>
      <p className="text-sm text-muted">{t("chat.missing", { kind: label, id })}</p>
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
