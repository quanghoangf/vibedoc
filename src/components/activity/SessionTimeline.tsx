"use client"

import { useEffect, useState } from "react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { catchUp, isLive } from "@/lib/sessions"
import { SessionCard } from "./SessionCard"

const DAY_MS = 24 * 60 * 60 * 1000

function dayLabel(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

const clock = (ts: string) => new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-display text-2xl font-semibold tabular-nums leading-none", value ? tone ?? "text-txt" : "text-muted/50")}>{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  )
}

type ActorFilter = "all" | "ai" | "human"

interface SessionTimelineProps {
  sessions: Session[]
  events: Map<string, ActivityEvent>
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  focusSessionId?: string | null
}

export function SessionTimeline({ sessions, events, onOpenTask, onOpenDoc, focusSessionId }: SessionTimelineProps) {
  const [actor, setActor] = useState<ActorFilter>("all")
  // Ticking clock: expires "live" badges and keeps the 24h window honest without new events
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const day = catchUp(sessions, now - DAY_MS)
  const counts = { all: sessions.length, ai: sessions.filter(s => s.actor === "ai").length, human: sessions.filter(s => s.actor === "human").length }
  const shown = actor === "all" ? sessions : sessions.filter(s => s.actor === actor)

  return (
    <div>
      {/* Catch-up: the one-read answer to "what happened while I was away?" */}
      <section className="mb-6 grid grid-cols-2 gap-5 rounded-xl border border-border bg-surface px-5 py-4 animate-fade-in sm:grid-cols-4">
        <Stat value={day.sessions} label="sessions · 24h" />
        <Stat value={day.tasksDone} label="tasks done" tone="text-teal" />
        <Stat value={day.docs} label="docs changed" />
        <Stat value={day.decisions} label="ADRs logged" tone="text-accent" />
      </section>

      <div className="mb-4 flex items-center gap-1 text-xs" role="tablist" aria-label="Filter by actor">
        {(["all", "ai", "human"] as const).map(a => (
          <button
            key={a}
            role="tab"
            aria-selected={actor === a}
            onClick={() => setActor(a)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors duration-(--duration-fast)",
              actor === a ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
            )}
          >
            {a === "all" ? "All" : a === "ai" ? "🤖 Agent" : "👤 Human"}
            <span className="ml-1.5 font-mono text-muted">{counts[a]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No {actor === "ai" ? "agent" : "human"} sessions yet.</p>
      ) : (
        <ol className="relative">
          {/* Rail runs behind the dots, between the clock gutter and the cards */}
          <div className="absolute left-[3.5rem] top-2 bottom-2 w-px bg-border" aria-hidden />
          {shown.map((s, i) => {
            const label = dayLabel(s.start)
            const showDay = i === 0 || dayLabel(shown[i - 1].start) !== label
            const live = isLive(s, now)
            // Matches SessionCard's one-line layout for sessions with nothing to link
            const quiet = s.tasks.length + s.docs.length + s.decisions.length === 0
            return (
              <li
                key={s.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms`, animationFillMode: "both" }}
              >
                {showDay && (
                  <p className="sticky top-0 z-10 -mx-1 mb-2 bg-bg/90 px-1 py-2 text-xs font-mono uppercase tracking-wide text-muted backdrop-blur-sm">
                    {label}
                  </p>
                )}
                <div className="grid grid-cols-[2.75rem_1.5rem_1fr] items-start pb-3">
                  <time dateTime={s.start} className={cn("text-right font-mono text-[11px] text-muted", quiet ? "pt-2.5" : "pt-4")} title={new Date(s.start).toLocaleString()}>
                    {clock(s.start)}
                  </time>
                  <span className={cn("flex justify-center", quiet ? "pt-[0.95rem]" : "pt-[1.2rem]")} aria-hidden>
                    <span
                      className={cn(
                        "relative z-[1] rounded-full ring-4 ring-bg",
                        quiet ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
                        s.actor === "ai" ? "bg-accent" : "bg-muted",
                        live && "animate-pulse-dot",
                      )}
                    />
                  </span>
                  <SessionCard
                    session={s}
                    // eventIds are chronological; the feed reads oldest → newest within a session
                    events={s.eventIds.flatMap(id => events.get(id) ?? [])}
                    onOpenTask={onOpenTask}
                    onOpenDoc={onOpenDoc}
                    focused={s.id === focusSessionId}
                    live={live}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
