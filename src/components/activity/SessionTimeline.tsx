"use client"

import { useEffect, useState } from "react"
import { Bot, User } from "lucide-react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { isLive } from "@/lib/sessions"
import { SessionCard } from "./SessionCard"
import type { EventTarget } from "@/lib/activity"
import { useFormat, useT } from "@/context/LanguageContext"

/** Sticky day heading shared by the sessions timeline and the event feed. */
export function DayLabel({ label }: { label: string }) {
  return (
    <h2 className="sticky top-0 z-10 -mx-1 mt-4 mb-1 flex items-center gap-3 bg-bg/90 px-1 py-2 backdrop-blur-sm first:mt-0">
      <span className="text-[13px] font-semibold text-txt">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </h2>
  )
}

type ActorFilter = "all" | "ai" | "human"

interface SessionTimelineProps {
  sessions: Session[]
  events: Map<string, ActivityEvent>
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  onOpen?: (target: EventTarget) => void
  focusSessionId?: string | null
}

export function SessionTimeline({ sessions, events, onOpenTask, onOpenDoc, onOpen, focusSessionId }: SessionTimelineProps) {
  const f = useFormat()
  const { t } = useT()
  const [actor, setActor] = useState<ActorFilter>("all")
  // Ticking clock: expires "working" badges without new events
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const counts = { all: sessions.length, ai: sessions.filter(s => s.actor === "ai").length, human: sessions.filter(s => s.actor === "human").length }
  const shown = actor === "all" ? sessions : sessions.filter(s => s.actor === actor)

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 text-xs" role="group" aria-label={t("memory.filterByActor")}>
        {(["all", "ai", "human"] as const).map(a => {
          const Icon = a === "ai" ? Bot : a === "human" ? User : null
          return (
            <button
              key={a}
              aria-pressed={actor === a}
              onClick={() => setActor(a)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors duration-(--duration-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                actor === a ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {a === "all" ? t("memory.all") : a === "ai" ? t("memory.agent") : t("memory.human")}
              <span className="font-mono text-[11px] text-muted tabular-nums">{counts[a]}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{actor === "ai" ? t("memory.noAgentSessions") : t("memory.noHumanSessions")}</p>
      ) : (
        <ol className="relative">
          {/* Rail runs behind the dots, between the clock gutter and the cards */}
          <div className="absolute left-[3.5rem] top-10 bottom-2 w-px bg-border" aria-hidden />
          {shown.map((s, i) => {
            const label = f.dayHeading(s.start)
            const showDay = i === 0 || f.dayHeading(shown[i - 1].start) !== label
            const live = isLive(s, now)
            // Matches SessionCard's one-line layout for sessions with nothing to link
            const quiet = s.tasks.length + s.docs.length + s.decisions.length === 0
            return (
              <li
                key={s.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms`, animationFillMode: "both" }}
              >
                {showDay && <DayLabel label={label} />}
                <div className={cn("grid grid-cols-[2.75rem_1.5rem_minmax(0,1fr)] items-start", quiet ? "pb-1" : "py-2")}>
                  <time dateTime={s.start} className={cn("text-right font-mono text-[11px] tabular-nums", quiet ? "pt-2 text-muted" : "pt-4 text-txt")} title={f.dateTime(s.start)}>
                    {f.clock(s.start)}
                  </time>
                  <span className={cn("flex justify-center", quiet ? "pt-[0.8rem]" : "pt-[1.15rem]")} aria-hidden>
                    <span
                      className={cn(
                        "relative z-[1] rounded-full ring-4 ring-bg",
                        quiet ? "size-1.5 bg-border2" : "size-2.5",
                        !quiet && (s.actor === "ai" ? "bg-accent" : "bg-muted"),
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
                    onOpen={onOpen}
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
