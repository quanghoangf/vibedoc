"use client"

import { useEffect, useRef, useState } from "react"
import type { ActivityEvent, Session } from "@/types"
import { cn } from "@/lib/utils"
import { sessionDuration } from "@/lib/sessions"
import { ActivityEventRow } from "./ActivityEventRow"

const STATUS_DOT: Record<string, string> = {
  done: "bg-teal",
  "in-progress": "bg-amber",
  review: "bg-accent",
  blocked: "bg-danger",
  todo: "bg-muted",
  cancelled: "bg-border2",
}

const chip =
  "inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border bg-bg/40 px-2 py-1 text-xs font-mono text-txt transition-[border-color,background-color,transform] duration-(--duration-fast) ease-out-soft hover:-translate-y-px hover:border-border2 hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"

interface SessionCardProps {
  session: Session
  events: ActivityEvent[]
  onOpenTask: (taskId: string) => void
  onOpenDoc: (path: string) => void
  focused?: boolean
  live?: boolean
}

/** Expandable body shared by cards and quiet rows: grid-rows 0fr↔1fr animates height without measuring. */
function EventList({ open, events }: { open: boolean; events: ActivityEvent[] }) {
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity] duration-(--duration-slow) ease-out-soft", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
        <div className="relative mt-4 border-t border-border pt-4">
          <div className="absolute left-4 top-4 bottom-0 w-px bg-border" />
          {events.map(e => <ActivityEventRow key={e.id} event={e} />)}
        </div>
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={cn("inline-block text-muted transition-transform duration-(--duration-base) ease-out-soft", open && "rotate-90")} aria-hidden>
      ▸
    </span>
  )
}

export function SessionCard({ session, events, onOpenTask, onOpenDoc, focused = false, live = false }: SessionCardProps) {
  const [open, setOpen] = useState(focused)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [focused])

  const isAgent = session.actor === "ai"
  const done = session.tasks.filter(t => t.lastStatus === "done").length
  const hasLinks = session.tasks.length + session.docs.length + session.decisions.length > 0
  const meta = `${sessionDuration(session)} · ${session.eventCount} event${session.eventCount === 1 ? "" : "s"}`

  // Quiet sessions (only roadmap edits, reads, session starts) collapse to one line so real work stands out.
  if (!hasLinks) {
    return (
      <div ref={ref} className={cn("rounded-lg px-3 py-2 transition-colors duration-(--duration-fast) hover:bg-surface/60", focused && "bg-surface animate-flash")}>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-sm text-muted">
          <span>{isAgent ? "🤖" : "👤"}</span>
          <span className="truncate">{session.headline}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-muted/70">{meta}</span>
          <Chevron open={open} />
        </button>
        <EventList open={open} events={events} />
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "group rounded-xl border bg-surface p-4 transition-[border-color,transform,box-shadow] duration-(--duration-base) ease-out-soft hover:-translate-y-0.5 hover:border-border2 hover:shadow-lg hover:shadow-black/20",
        live ? "border-accent/40" : "border-border",
        focused && "border-accent/60 animate-flash",
      )}
    >
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-xs">
        <span className={cn("font-medium", isAgent ? "text-accent" : "text-txt")}>{isAgent ? "🤖 Agent" : "👤 Human"}</span>
        {live && (
          <span className="flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            live
          </span>
        )}
        <span className="ml-auto font-mono text-muted">{meta}</span>
        <Chevron open={open} />
      </button>

      <p className="mt-2 text-[15px] font-medium leading-snug text-txt">{session.headline}</p>

      {session.tasks.length > 0 && (
        <div className="mt-3 flex items-center gap-2" title={`${done} of ${session.tasks.length} tasks done`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full origin-left rounded-full bg-teal animate-grow-x transition-[width] duration-(--duration-slow) ease-out-soft"
              style={{ width: `${(done / session.tasks.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted">{done}/{session.tasks.length}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {session.tasks.map(t => (
          <button key={t.id} onClick={() => onOpenTask(t.id)} className={chip} title={`${t.id} → ${t.lastStatus}`}>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[t.lastStatus])} />
            {t.id}
            <span className="text-muted">{t.lastStatus}</span>
          </button>
        ))}
        {session.docs.map(d => (
          <button key={d} onClick={() => onOpenDoc(d)} className={chip} title={d}>
            📄 {d.split("/").pop()}
          </button>
        ))}
        {session.decisions.map(d => (
          <button key={d} onClick={() => onOpenDoc(d.split(":")[0])} className={cn(chip, "text-accent")} title={d}>
            📝 {d}
          </button>
        ))}
      </div>

      <EventList open={open} events={events} />
    </div>
  )
}
