"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { ActivityFeed } from "./ActivityFeed"
import { SessionTimeline } from "./SessionTimeline"
import Link from "next/link"
import { Activity as ActivityIcon, Bot, Plug, User } from "lucide-react"
import { catchUp } from "@/lib/sessions"
import { EVENT_CATEGORIES, eventCategory, filterEvents, type EventCategory, type EventTarget } from "@/lib/activity"
import { useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { CONNECT_HREF, useAgentConnected } from "@/components/shared/agent-connection"
import type { MessageKey, PluralKey } from "@/i18n"

const CATEGORY_KEY: Record<EventCategory, MessageKey> = {
  task: "memory.catTask", doc: "memory.catDoc", epic: "memory.catEpic", memory: "memory.catMemory", decision: "memory.catDecision", session: "memory.catSession",
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "5 tasks done · 1 ADR · 4 sessions": the one-read answer to "what happened while I was away?" Zeros drop out. */
function Summary({ sessions }: { sessions: Session[] }) {
  // Ticks so the 24h window stays honest without new events
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const { t, tn } = useT()
  const day = catchUp(sessions, now - DAY_MS)
  const parts = ([
    [day.tasksDone, "memory.tasksDone"],
    [day.decisions, "memory.adrsLogged"],
    [day.docs, "memory.docsChanged"],
    [day.sessions, "memory.sessionsCount"],
  ] as [number, PluralKey][]).filter(([n]) => n > 0)
  if (!parts.length) return <>{t("memory.quiet")}</>
  return (
    <>
      {parts.map(([n, key], i) => {
        // the count stays mono: split the message around it ("{n} tasks done" → [n] "tasks done")
        const [before, after] = tn(key, n).split(String(n))
        return (
          <span key={key}>
            {i > 0 && <span className="text-muted"> · </span>}
            {before}<span className="font-mono tabular-nums">{n}</span>{after}
          </span>
        )
      })}
      <span className="font-normal text-muted"> {t("memory.inLast24h")}</span>
    </>
  )
}

interface ActivityTabProps {
  activity: ActivityEvent[]
  rootParam: string
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  focusSessionId?: string | null
}

export function ActivityTab({ activity, rootParam, onOpenTask, onOpenDoc, focusSessionId }: ActivityTabProps) {
  const { t } = useT()
  const [view, setView] = useState<"sessions" | "events">("sessions")
  // A new focus target (from a task's Sessions list) always lands on the Sessions view
  const [lastFocus, setLastFocus] = useState(focusSessionId)
  if (focusSessionId !== lastFocus) {
    setLastFocus(focusSessionId)
    if (focusSessionId) setView("sessions")
  }
  const [sessions, setSessions] = useState<Session[] | null>(null) // null = first load
  const [failed, setFailed] = useState(false)
  const [events, setEvents] = useState<Map<string, ActivityEvent>>(new Map())

  // Refetch on every SSE event (AppContext re-dispatches them as `vibedoc:sse`), not only the ones that refresh `activity`.
  useEffect(() => {
    const qs = rootParam ? `${rootParam}&` : "?"
    const load = () => Promise.all([
      fetch(`/api/sessions${rootParam}`).then(r => r.json()),
      fetch(`/api/activity${qs}limit=2000`).then(r => r.json()),
    ])
      .then(([ses, evs]) => {
        setFailed(false)
        setSessions(Array.isArray(ses) ? ses : [])
        setEvents(new Map((Array.isArray(evs) ? evs as ActivityEvent[] : []).map(e => [e.id, e])))
      })
      .catch(() => { setFailed(true); setSessions(prev => prev ?? []) })
    load()
    window.addEventListener("vibedoc:sse", load)
    return () => window.removeEventListener("vibedoc:sse", load)
  }, [rootParam])

  // The 2000-event log fetched above; AppContext's 30 rows only until it arrives
  const all = useMemo(() => (events.size ? [...events.values()] : activity), [events, activity])
  const empty = view === "sessions" ? sessions?.length === 0 : all.length === 0
  const connected = useAgentConnected()

  const router = useRouter()
  const open = (t: EventTarget) => {
    if (t.kind === "task") onOpenTask(t.id)
    else if (t.kind === "doc") onOpenDoc(t.path)
    else if (t.kind === "epic") router.push(`/roadmap?item=${t.id}`)
    else if (t.kind === "entry") router.push(`/memory?entry=${t.id}`)
    else router.push("/memory")
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-border pb-5">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">{t("shell.activity")}</h1>
          <p className="mt-2 text-[1.1rem] leading-snug font-semibold text-txt">
            {sessions === null ? <span className="text-muted">{t("memory.loading")}</span> : <Summary sessions={sessions} />}
          </p>
          <p className="mt-1 text-sm text-muted">{t("memory.readFrom")} <code className="font-mono text-[0.9em]">.vibedoc-activity.json</code>.</p>
        </div>
        {/* Segmented toggle with a sliding pill */}
        <div className="relative grid grid-cols-2 rounded-md border border-border p-0.5 text-xs" role="group" aria-label={t("memory.view")}>
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm bg-surface2 transition-transform duration-(--duration-base) ease-out-soft",
              view === "events" && "translate-x-full",
            )}
          />
          {(["sessions", "events"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("relative rounded-sm px-3 py-1 transition-colors duration-(--duration-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60", view === v ? "text-txt" : "text-muted hover:text-txt")}
            >
              {v === "sessions" ? t("memory.sessions") : t("memory.allEvents")}
            </button>
          ))}
        </div>
      </header>

      {failed && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger animate-fade-in">
          {t("memory.loadFailed")}
        </p>
      )}

      {view === "sessions" && sessions === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("memory.loadingSessions")}>
          {[0, 1, 2].map(i => (
            <div key={i} className="ml-[4.25rem] h-24 rounded-lg bg-surface animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          bordered
          icon={<ActivityIcon className="size-6" />}
          message={t("memory.noActivity")}
          lead={t("memory.noActivityHint")}
          // no agent yet: connecting it is what fills this page
          action={connected
            ? <Button asChild size="sm"><Link href="/board">{t("memory.openBoard")}</Link></Button>
            : <Button asChild size="sm"><Link href={CONNECT_HREF}><Plug className="size-4" aria-hidden /> {t("shell.connectYourAgent")}</Link></Button>}
        />
      ) : view === "sessions" ? (
        <SessionTimeline key={focusSessionId ?? ""} focusSessionId={focusSessionId} sessions={sessions ?? []} events={events} onOpenTask={onOpenTask} onOpenDoc={onOpenDoc} onOpen={open} />
      ) : (
        <FilteredFeed events={all} onOpen={open} />
      )}
    </div>
  )
}

const filterChip = (on: boolean) => cn(
  "flex h-6 items-center gap-1.5 rounded-[5px] border border-transparent px-2 text-xs font-medium outline-none transition-colors duration-(--duration-fast)",
  "hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60",
  on ? "border-border2 bg-surface2 text-txt" : "text-muted",
)

/** "All events" with a kind filter (Tasks, Docs, …) and a who filter (agents / you). */
function FilteredFeed({ events, onOpen }: { events: ActivityEvent[]; onOpen: (t: EventTarget) => void }) {
  const { t } = useT()
  const [category, setCategory] = useState<EventCategory | null>(null)
  const [actor, setActor] = useState<ActivityEvent["actor"] | null>(null)
  const shown = useMemo(() => filterEvents(events, { category, actor }), [events, category, actor])
  // Kind counts follow the who filter, and the other way round, so a count is what clicking it would show
  const kindCounts = useMemo(() => {
    const c: Partial<Record<EventCategory, number>> = {}
    for (const e of filterEvents(events, { category: null, actor })) c[eventCategory(e)] = (c[eventCategory(e)] ?? 0) + 1
    return c
  }, [events, actor])
  const byActor = filterEvents(events, { category, actor: null })
  const actorCount = { all: byActor.length, ai: byActor.filter(e => e.actor === "ai").length, human: byActor.filter(e => e.actor === "human").length }
  const kindTotal = Object.values(kindCounts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("memory.filterByKind")}>
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={filterChip(category === null)}>
            {t("memory.all")} <span className="font-mono text-[10px] opacity-70">{kindTotal}</span>
          </button>
          {EVENT_CATEGORIES.filter(c => kindCounts[c.id] || category === c.id).map(c => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)} className={filterChip(category === c.id)}>
              {t(CATEGORY_KEY[c.id])} <span className="font-mono text-[10px] opacity-70">{kindCounts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 sm:ml-auto" role="group" aria-label={t("memory.filterByActor")}>
          {([null, "ai", "human"] as const).map(a => {
            const Icon = a === "ai" ? Bot : a === "human" ? User : null
            return (
              <button key={a ?? "all"} type="button" aria-pressed={actor === a} onClick={() => setActor(a)} className={filterChip(actor === a)}>
                {Icon && <Icon className="size-3" aria-hidden />}
                {a === null ? t("memory.everyone") : a === "ai" ? t("memory.agents") : t("memory.you")}
                <span className="font-mono text-[10px] opacity-70">{actorCount[a ?? "all"]}</span>
              </button>
            )
          })}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted">
          {t("memory.noMatchingEvents")}
          <button type="button" onClick={() => { setCategory(null); setActor(null) }} className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            {t("memory.clearFilters")}
          </button>
        </div>
      ) : (
        <ActivityFeed activity={shown} onOpen={onOpen} />
      )}
    </div>
  )
}
