"use client"

import { useEffect, useState } from "react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { ActivityFeed } from "./ActivityFeed"
import { SessionTimeline } from "./SessionTimeline"
import { EmptyState } from "@/components/shared/EmptyState"

interface ActivityTabProps {
  activity: ActivityEvent[]
  liveIndicator: boolean
  rootParam: string
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  focusSessionId?: string | null
}

export function ActivityTab({ activity, liveIndicator, rootParam, onOpenTask, onOpenDoc, focusSessionId }: ActivityTabProps) {
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
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">Activity</h1>
        <div className="flex items-center gap-4">
          {/* Segmented toggle with a sliding pill */}
          <div className="relative grid grid-cols-2 rounded-md border border-border p-0.5 text-xs">
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
                className={cn("relative px-3 py-1 transition-colors duration-(--duration-fast)", view === v ? "text-txt" : "text-muted hover:text-txt")}
              >
                {v === "sessions" ? "Sessions" : "All events"}
              </button>
            ))}
          </div>
          {/* Pings when an SSE event lands */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-teal">
            <span className="relative flex h-1.5 w-1.5">
              {liveIndicator && <span className="absolute inset-0 rounded-full bg-teal animate-ping" />}
              <span className="relative h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
            live
          </div>
        </div>
      </div>

      {failed && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger animate-fade-in">
          Couldn&apos;t load sessions. Showing the last data we had; it retries on the next update.
        </p>
      )}

      {view === "sessions" && sessions === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading sessions">
          <div className="h-[76px] rounded-xl bg-surface animate-pulse" />
          {[0, 1, 2].map(i => (
            <div key={i} className="ml-[4.25rem] h-24 rounded-xl bg-surface animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          icon="⚡"
          message="No activity yet."
          subMessage="Connect an AI agent to see real-time updates here."
        />
      ) : view === "sessions" ? (
        <SessionTimeline key={focusSessionId ?? ""} focusSessionId={focusSessionId} sessions={sessions ?? []} events={events} onOpenTask={onOpenTask} onOpenDoc={onOpenDoc} />
      ) : (
        <ActivityFeed activity={activity} />
      )}
    </div>
  )
}
