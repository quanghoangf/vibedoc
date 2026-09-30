"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import type { Task } from "@/types"
import { STATUS_ICONS } from "./TaskCard"
import { TaskSessions } from "./TaskSessions"
import Link from "next/link"
import { Check, CornerUpLeft, FlaskConical, MessageSquare } from "lucide-react"
import { AgentMark } from "@/components/chat/AgentMark"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { chatFor } from "@/lib/chats"
import { reviewHistory, type ReviewEntry } from "@/lib/review"

const NEXT_STATUS: Record<string, string[]> = {
  todo: ["in-progress"],
  "in-progress": ["done", "review", "blocked", "todo"],
  // Review tasks get Approve / Send back instead (ReviewActions)
  review: [],
  blocked: ["in-progress", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
}

const STATUS_LABELS: Record<string, string> = {
  "in-progress": "start",
  review: "to review",
  done: "done",
  blocked: "blocked",
  todo: "backlog",
  cancelled: "cancel",
}

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted border-border2",
  "in-progress": "text-amber border-amber/30 bg-amber/5",
  review: "text-accent border-accent/30 bg-accent/5",
  blocked: "text-danger border-danger/30 bg-danger/5",
  done: "text-teal border-teal/30 bg-teal/5",
  cancelled: "text-muted border-border",
}

interface TaskDetailPanelProps {
  task: Task | null
  onClose: () => void
  onMove: (id: string, status: string) => void
}

export function TaskDetailPanel({ task: openTask, onClose, onMove }: TaskDetailPanelProps) {
  // Keep the last task rendered while the sheet slides out
  const [task, setTask] = useState(openTask)
  if (openTask && openTask !== task) setTask(openTask)

  const nextStatuses = task ? NEXT_STATUS[task.status] || [] : []
  const { chats, showAbout } = useChats()
  const chat = task ? chatFor(chats, { kind: "task", id: task.id }) : undefined

  return (
    <Sheet open={!!openTask} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" aria-describedby={undefined} className="p-0 gap-0 sm:max-w-[420px] border-border flex flex-col">
        {task && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-1 min-w-0 pl-5 pr-12 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">{task.id}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded-sm border font-mono", STATUS_COLORS[task.status])}>
                  {STATUS_ICONS[task.status]} {task.status}
                </span>
                <AgentMark attach={{ kind: "task", id: task.id }} />
              </div>
              <SheetTitle className="font-medium text-txt text-sm leading-snug">{task.title}</SheetTitle>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => { onMove(task.id, s); onClose() }}
                  className="text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
                >
                  {STATUS_ICONS[s]} {STATUS_LABELS[s] || s}
                </button>
              ))}
              <button
                onClick={() => { onClose(); showAbout({ kind: "task", id: task.id }) }}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-accent text-white transition-[filter] hover:brightness-110"
              >
                <MessageSquare className="size-3.5" /> {chat ? "Open chat" : "Chat about task"}
              </button>
            </div>

            {task.status === "review" && <ReviewActions key={`review-${task.id}`} taskId={task.id} onDone={onClose} />}

            {task.manualTests && (
              <Link
                href={`/manual-tests#${task.id}`}
                onClick={onClose}
                className="group flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0 text-xs text-muted hover:bg-surface2 hover:text-txt transition-colors"
              >
                <FlaskConical className="size-3.5" />
                <span className={cn("font-mono", task.manualTests.done === task.manualTests.total && "text-teal")}>
                  {task.manualTests.done}/{task.manualTests.total}
                </span>
                manual tests ticked
                <span className="ml-auto text-accent opacity-0 transition-opacity group-hover:opacity-100">Open checklist →</span>
              </Link>
            )}

            <ReviewHistory entries={reviewHistory(task.raw ?? "")} />

            <TaskSessions key={task.id} taskId={task.id} onNavigate={onClose} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {task.raw ? (
                <MarkdownRenderer content={task.raw} />
              ) : (
                <p className="text-sm text-muted">No content available.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Approve (→ done) or send back with a note (→ todo) a task waiting in Review. */
function ReviewActions({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const { rootParam } = useApp()
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: "approve" | "send-back") {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/review${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, action, note }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`)
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border shrink-0 bg-accent/5">
      <p className="text-xs text-muted">Waiting for your review. Approving moves it to done; sending it back returns it to the queue with your note.</p>
      {sendingBack ? (
        <div className="flex flex-col gap-2 animate-fade-in">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What needs to change? The agent reads this first."
            aria-label="Send back note"
            className="w-full resize-none rounded-md border border-border bg-bg px-2.5 py-2 text-sm text-txt placeholder:text-muted focus:border-accent/60 focus:outline-hidden"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => act("send-back")}
              disabled={busy || !note.trim()}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-amber/15 border border-amber/40 text-amber transition-colors hover:bg-amber/25 disabled:opacity-40"
            >
              <CornerUpLeft className="size-3.5" /> Send back
            </button>
            <button onClick={() => { setSendingBack(false); setNote("") }} disabled={busy} className="text-xs text-muted hover:text-txt">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => act("approve")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-teal/15 border border-teal/40 text-teal transition-colors hover:bg-teal/25 disabled:opacity-40"
          >
            <Check className="size-3.5" /> Approve
          </button>
          <button
            onClick={() => setSendingBack(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted transition-colors hover:text-txt hover:border-border2"
          >
            <CornerUpLeft className="size-3.5" /> Send back…
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
}

/** Past review outcomes, newest first. */
function ReviewHistory({ entries }: { entries: ReviewEntry[] }) {
  if (!entries.length) return null
  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border shrink-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Review history</p>
      <ul className="flex flex-col gap-2">
        {[...entries].reverse().map((e, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-xs">
              <span className={cn("font-medium", e.outcome === "approved" ? "text-teal" : "text-amber")}>
                {e.outcome === "approved" ? "Approved" : "Changes requested"}
              </span>
              <span className="font-mono text-[10px] text-muted">{e.at.replace("T", " ").replace(/:\d\dZ$/, "Z")}</span>
            </span>
            {e.note && <p className="whitespace-pre-wrap text-xs text-muted">{e.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
