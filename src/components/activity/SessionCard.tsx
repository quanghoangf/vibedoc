"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, ChevronRight, FileText, Scale, User } from "lucide-react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { ActivityEventRow } from "./ActivityEventRow"
import type { EventTarget } from "@/lib/activity"
import { useFormat, useT } from "@/context/LanguageContext"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import { useSessionHeadline } from "./session-text"

// One mark per task, filled with the task's status hue (the One Status Language, as a bar)
const STATUS_BAR: Record<string, string> = {
  done: "bg-teal",
  "in-progress": "bg-amber",
  review: "bg-accent",
  blocked: "bg-danger",
  todo: "bg-border2",
  cancelled: "bg-border2",
}

const chip =
  "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-txt transition-colors duration-(--duration-fast) hover:border-border2 hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"

interface SessionCardProps {
  session: Session
  events: ActivityEvent[]
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  onOpen?: (target: EventTarget) => void
  focused?: boolean
  live?: boolean
}

/** Expandable body shared by cards and quiet rows: grid-rows 0fr↔1fr animates height without measuring. */
function EventList({ open, events, onOpen }: { open: boolean; events: ActivityEvent[]; onOpen?: (target: EventTarget) => void }) {
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity] duration-(--duration-slow) ease-out-soft", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
        <div className="mt-3 border-t border-border pt-2">
          {events.map(e => <ActivityEventRow key={e.id} event={e} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--duration-base) ease-out-soft", open && "rotate-90")} />
}


export function SessionCard({ session, events, onOpenTask, onOpenDoc, onOpen, focused = false, live = false }: SessionCardProps) {
  const [open, setOpen] = useState(focused)
  const ref = useRef<HTMLDivElement>(null)
  const { t, tn } = useT()
  const f = useFormat()
  const statusLabel = useStatusLabel()
  const headlineOf = useSessionHeadline()
  const headline = headlineOf(session)
  const minutes = Math.round((Date.parse(session.end) - Date.parse(session.start)) / 60_000)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [focused])

  const isAgent = session.actor === "ai"
  const Actor = isAgent ? Bot : User
  const done = session.tasks.filter(t => t.lastStatus === "done").length
  const hasLinks = session.tasks.length + session.docs.length + session.decisions.length > 0
  const count = tn("memory.events", session.eventCount)

  // Quiet sessions (only roadmap edits, reads, session starts) collapse to one line so real work stands out.
  if (!hasLinks) {
    return (
      <div ref={ref} className={cn("min-w-0 rounded-md px-3 py-1.5 transition-colors duration-(--duration-fast) hover:bg-surface/60", focused && "bg-surface animate-flash")}>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full min-w-0 items-center gap-2 text-left text-[13px] text-muted focus-visible:text-txt focus-visible:outline-none">
          <Actor className="size-3.5 shrink-0" aria-label={isAgent ? t("memory.agent") : t("memory.human")} />
          {/* "1 event" says nothing: a session that only connected reads as such */}
          <span className="min-w-0 truncate">{hasLinks || session.memoryUpdated || session.roadmapEdits ? headline : t("memory.connectedNothing")}</span>
          <span className="ml-auto shrink-0 font-mono text-[11px]">{f.duration(minutes)}<span className="hidden sm:inline"> · {count}</span></span>
          <Chevron open={open} />
        </button>
        <EventList open={open} events={events} onOpen={onOpen} />
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "min-w-0 rounded-lg border bg-surface transition-colors duration-(--duration-base) hover:border-border2",
        live ? "border-accent/40" : "border-border",
        focused && "border-accent/60 animate-flash",
      )}
    >
      <div className="px-4 pt-3.5 pb-4">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="group flex w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none">
          <Actor className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span className="text-xs text-muted">{isAgent ? t("memory.agent") : t("memory.human")}</span>
          {live && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
              <span className="size-1.5 rounded-full bg-accent animate-pulse-dot" />
              {t("memory.working")}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">{f.duration(minutes)} · {count}</span>
          <span className="flex items-center gap-1 text-[11px] text-muted group-hover:text-txt group-focus-visible:text-txt">
            <Chevron open={open} />
          </span>
        </button>

        <p className="mt-1.5 text-[15px] leading-snug font-semibold text-txt">{headline}</p>

        {session.tasks.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex flex-1 gap-0.5" role="img" aria-label={t("memory.tasksDoneOf", { done, total: session.tasks.length })}>
              {session.tasks.map(t => <span key={t.id} className={cn("h-1 flex-1 rounded-full", STATUS_BAR[t.lastStatus] ?? "bg-border2")} />)}
            </div>
            <span className="font-mono text-[11px] text-muted tabular-nums"><span className="text-txt">{done}</span>/{session.tasks.length}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.tasks.map(t => (
            <button key={t.id} onClick={() => onOpenTask(t.id)} className={chip} title={`${t.id} → ${statusLabel(t.lastStatus)}`}>
              <StatusIcon status={t.lastStatus} className="size-3" />
              {t.id}
            </button>
          ))}
          {session.docs.map(d => (
            <button key={d} onClick={() => onOpenDoc(d)} className={chip} title={d}>
              <FileText className="size-3 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{d.split("/").pop()}</span>
            </button>
          ))}
          {session.decisions.map(d => {
            const [id, ...rest] = d.split(":")
            return (
              <button key={d} onClick={() => onOpenDoc(id)} className={cn(chip, "font-sans text-xs")} title={d}>
                <Scale className="size-3 shrink-0 text-muted" aria-hidden />
                <span className="shrink-0 font-mono text-[11px] whitespace-nowrap">{id}</span>
                {rest.length > 0 && <span data-user-content className="truncate text-muted">{rest.join(":").trim()}</span>}
              </button>
            )
          })}
        </div>

        <EventList open={open} events={events} onOpen={onOpen} />
      </div>
    </div>
  )
}
