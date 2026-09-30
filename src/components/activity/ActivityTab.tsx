"use client"

import { useEffect, useState } from "react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { ActivityFeed } from "./ActivityFeed"
import { SessionTimeline } from "./SessionTimeline"
import { Activity as ActivityIcon } from "lucide-react"
import { catchUp } from "@/lib/sessions"

const DAY_MS = 24 * 60 * 60 * 1000

/** "5 tasks done · 1 ADR · 4 sessions": the one-read answer to "what happened while I was away?" Zeros drop out. */
function Summary({ sessions }: { sessions: Session[] }) {
  // Ticks so the 24h window stays honest without new events
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const day = catchUp(sessions, now - DAY_MS)
  const parts = ([
    [day.tasksDone, "task", "done"],
    [day.decisions, "ADR", "logged"],
    [day.docs, "doc", "changed"],
    [day.sessions, "session", ""],
  ] as const).filter(([n]) => n > 0)
  if (!parts.length) return <>Quiet for the last 24 hours</>
  return (
    <>
      {parts.map(([n, noun, verb], i) => (
        <span key={noun}>
          {i > 0 && <span className="text-muted"> · </span>}
          <span className="font-mono tabular-nums">{n}</span> {noun}{n === 1 ? "" : "s"}{verb && ` ${verb}`}
        </span>
      ))}
      <span className="font-normal text-muted"> in the last 24h</span>
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

  const empty = view === "sessions" ? sessions?.length === 0 : activity.length === 0

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-border pb-5">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">Activity</h1>
          <p className="mt-2 text-[1.1rem] leading-snug font-semibold text-txt">
            {sessions === null ? <span className="text-muted">Loading…</span> : <Summary sessions={sessions} />}
          </p>
          <p className="mt-1 text-sm text-muted">Everything agents and you changed, read from <code className="font-mono text-[0.9em]">.vibedoc-activity.json</code>.</p>
        </div>
        {/* Segmented toggle with a sliding pill */}
        <div className="relative grid grid-cols-2 rounded-md border border-border p-0.5 text-xs" role="group" aria-label="View">
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
              {v === "sessions" ? "Sessions" : "All events"}
            </button>
          ))}
        </div>
      </header>

      {failed && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger animate-fade-in">
          Couldn&apos;t load sessions. Showing the last data we had; it retries on the next update.
        </p>
      )}

      {view === "sessions" && sessions === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading sessions">
          {[0, 1, 2].map(i => (
            <div key={i} className="ml-[4.25rem] h-24 rounded-lg bg-surface animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border2 p-6 animate-fade-in">
          <ActivityIcon className="size-5 text-muted" aria-hidden />
          <p className="text-sm text-txt">No activity yet</p>
          <p className="max-w-lg text-xs leading-relaxed text-muted">
            Moves on the board and every agent call through the MCP server show up here as they happen. Use Connect in the header to hook up Claude Code or Cursor.
          </p>
        </div>
      ) : view === "sessions" ? (
        <SessionTimeline key={focusSessionId ?? ""} focusSessionId={focusSessionId} sessions={sessions ?? []} events={events} onOpenTask={onOpenTask} onOpenDoc={onOpenDoc} />
      ) : (
        <ActivityFeed activity={activity} />
      )}
    </div>
  )
}
