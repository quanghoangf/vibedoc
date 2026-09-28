"use client"

import { useState } from "react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { STATUS_BADGE_COLORS } from "@/components/board/TaskCard"
import { ActivityEventRow, timeAgo } from "./ActivityEventRow"

function duration(s: Session): string {
  const min = Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60_000)
  if (min < 1) return "<1m"
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`
}

const chip = "text-xs font-mono px-1.5 py-0.5 rounded-sm border hover:bg-surface2 truncate max-w-full"

interface SessionCardProps {
  session: Session
  events: ActivityEvent[]
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
}

export function SessionCard({ session, events, onOpenTask, onOpenDoc }: SessionCardProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-surface p-4 animate-fade-in">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 text-left text-xs text-muted font-mono">
        <span className="text-sm">{session.actor === "ai" ? "🤖" : "👤"}</span>
        <span>{session.actor === "ai" ? "Agent" : "Human"}</span>
        <span>· {timeAgo(session.start)}</span>
        <span>· {duration(session)}</span>
        <span>· {session.eventCount} event{session.eventCount === 1 ? "" : "s"}</span>
        <span className="ml-auto">{open ? "▾" : "▸"}</span>
      </button>
      <p className="mt-2 text-sm font-medium text-txt">{session.headline}</p>

      {(session.tasks.length > 0 || session.docs.length > 0 || session.decisions.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.tasks.map(t => (
            <button key={t.id} onClick={() => onOpenTask(t.id)} className={cn(chip, STATUS_BADGE_COLORS[t.lastStatus])} title={`${t.id} → ${t.lastStatus}`}>
              {t.id} · {t.lastStatus}
            </button>
          ))}
          {session.docs.map(d => (
            <button key={d} onClick={() => onOpenDoc(d)} className={cn(chip, "border-border2 text-txt")} title={d}>
              📄 {d.split("/").pop()}
            </button>
          ))}
          {session.decisions.map(d => (
            <button key={d} onClick={() => onOpenDoc(d.split(":")[0])} className={cn(chip, "border-accent/30 text-accent")} title={d}>
              📝 {d}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="relative mt-4">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          {events.map(e => <ActivityEventRow key={e.id} event={e} />)}
        </div>
      )}
    </div>
  )
}
