"use client"

import type { ActivityEvent, Session } from "@/types"
import { SessionCard } from "./SessionCard"

function dayLabel(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

interface SessionTimelineProps {
  sessions: Session[]
  events: Map<string, ActivityEvent>
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
}

export function SessionTimeline({ sessions, events, onOpenTask, onOpenDoc }: SessionTimelineProps) {
  return (
    <div className="flex flex-col gap-3">
      {sessions.map((s, i) => {
        const day = dayLabel(s.start)
        const showDay = i === 0 || dayLabel(sessions[i - 1].start) !== day
        return (
          <div key={s.id}>
            {showDay && <p className="mb-2 mt-3 text-xs font-mono uppercase tracking-wide text-muted first:mt-0">{day}</p>}
            <SessionCard
              session={s}
              // eventIds are chronological; the feed reads oldest → newest within a session
              events={s.eventIds.flatMap(id => events.get(id) ?? [])}
              onOpenTask={onOpenTask}
              onOpenDoc={onOpenDoc}
            />
          </div>
        )
      })}
    </div>
  )
}
