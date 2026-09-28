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

export function ActivityTab({ activity, rootParam, onOpenTask, onOpenDoc, focusSessionId }: ActivityTabProps) {
  const [view, setView] = useState<"sessions" | "events">("sessions")
  // A new focus target (from a task's Sessions list) always lands on the Sessions view
  const [lastFocus, setLastFocus] = useState(focusSessionId)
  if (focusSessionId !== lastFocus) {
    setLastFocus(focusSessionId)
    if (focusSessionId) setView("sessions")
  }
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Map<string, ActivityEvent>>(new Map())

  // Refetch on every SSE event (AppContext re-dispatches them as `vibedoc:sse`), not only the ones that refresh `activity`.
  useEffect(() => {
    const qs = rootParam ? `${rootParam}&` : "?"
    const load = () => Promise.all([
      fetch(`/api/sessions${rootParam}`).then(r => r.json()),
      fetch(`/api/activity${qs}limit=2000`).then(r => r.json()),
    ])
      .then(([ses, evs]) => {
        setSessions(Array.isArray(ses) ? ses : [])
        setEvents(new Map((Array.isArray(evs) ? evs as ActivityEvent[] : []).map(e => [e.id, e])))
      })
      .catch(() => { setSessions([]); setEvents(new Map()) })
    load()
    window.addEventListener("vibedoc:sse", load)
    return () => window.removeEventListener("vibedoc:sse", load)
  }, [rootParam])

  const empty = view === "sessions" ? sessions.length === 0 : activity.length === 0

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">Activity</h1>
        <div className="flex items-center gap-4">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {(["sessions", "events"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("px-2.5 py-1 rounded-sm", view === v ? "bg-surface2 text-txt" : "text-muted hover:text-txt")}
              >
                {v === "sessions" ? "Sessions" : "All events"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-teal">
            <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            live
          </div>
        </div>
      </div>

      {empty ? (
        <EmptyState
          icon="⚡"
          message="No activity yet."
          subMessage="Connect an AI agent to see real-time updates here."
        />
      ) : view === "sessions" ? (
        <SessionTimeline key={focusSessionId ?? ""} focusSessionId={focusSessionId} sessions={sessions} events={events} onOpenTask={onOpenTask} onOpenDoc={onOpenDoc} />
      ) : (
        <ActivityFeed activity={activity} />
      )}
    </div>
  )
}
