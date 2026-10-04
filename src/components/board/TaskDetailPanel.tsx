"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import type { Task } from "@/types"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { TaskSessions } from "./TaskSessions"
import Link from "next/link"
import { Calendar, Check, ChevronRight, CircleDashed, CornerUpLeft, Flag, FlaskConical, Map as MapIcon, MessageSquare, MoreHorizontal, Pencil, Ruler, Trash2, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useStatusDefs } from "@/components/shared/status-defs"
import { displayStatus } from "@/lib/statuses"
import { ItemPanelHeader, type ItemProperty } from "@/components/shared/ItemPanelHeader"
import { TaskDueField, TaskOwnerField, TaskPriorityField, TaskSizeField, TaskStatusField } from "./TaskFields"
import { epicOf } from "@/lib/board-views"
import { localToday, dueState } from "@/lib/roadmap-health"
import { DueChip } from "@/components/roadmap/RoadmapNodes"
import { itemKeyLabel, useItemCommands } from "@/components/shared/item-commands"
import { deleteTaskWithUndo, updateTask } from "./task-api"
import type { TaskMetaPatch } from "@/types"
import { AgentMark } from "@/components/chat/AgentMark"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { chatFor } from "@/lib/chats"
import { reviewHistory, type ReviewEntry } from "@/lib/review"

const NEXT_STATUS: Record<string, string[]> = {
  todo: ["in-progress", "paused"],
  "in-progress": ["done", "review", "blocked", "paused", "todo"],
  // Review tasks get Approve / Send back instead (ReviewActions)
  review: [],
  blocked: ["in-progress", "cancelled"],
  paused: ["in-progress", "todo"],
  done: ["todo"],
  cancelled: ["todo"],
}

const STATUS_LABELS: Record<string, string> = {
  "in-progress": "start",
  review: "to review",
  done: "done",
  blocked: "blocked",
  paused: "pause",
  todo: "backlog",
  cancelled: "cancel",
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
  const { rootParam, demo } = useApp()
  const chat = task ? chatFor(chats, { kind: "task", id: task.id }) : undefined
  // the edit form shows while this matches the open task
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = !!task && editingId === task.id
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const statusDefs = useStatusDefs()
  const chatAbout = () => { if (task) { onClose(); showAbout({ kind: "task", id: task.id }) } }
  useItemCommands(openTask && task && !editing ? `${task.id} · ${task.title}` : null, task ? [
    { action: "edit", label: "Edit", run: () => setEditingId(task.id) },
    { action: "status", label: "Change status…", run: () => setMenuOpen(true) },
    { action: "chat", label: "Chat about task", run: chatAbout },
    { action: "remove", label: "Delete", run: () => { remove() } },
  ] : [])

  async function remove() {
    if (!task) return
    setError(null)
    try {
      await deleteTaskWithUndo(task, rootParam)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Sheet open={!!openTask} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" aria-describedby={undefined} className="p-0 gap-0 sm:max-w-[420px] border-border flex flex-col">
        {task && (
          <>
            <ItemPanelHeader
              kicker={<TaskCrumb task={task} onNavigate={onClose} />}
              title={<SheetTitle className="text-base font-semibold leading-snug text-txt">{task.title}</SheetTitle>}
              menu={demo ? undefined :
                  <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Actions for ${task.id}`} className="ml-auto grid size-6 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => setEditingId(task.id)}><Pencil /> Edit<DropdownMenuShortcut>{itemKeyLabel("edit")}</DropdownMenuShortcut></DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger><StatusIcon status={displayStatus(task)} /> Status<DropdownMenuShortcut>{itemKeyLabel("status")}</DropdownMenuShortcut></DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {statusDefs.map((d) => (
                            <DropdownMenuItem key={d.id} disabled={d.id === displayStatus(task)} onSelect={() => onMove(task.id, d.id)}>
                              <StatusIcon status={d.id} /> {d.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem onSelect={chatAbout}><MessageSquare /> Chat about task<DropdownMenuShortcut>{itemKeyLabel("chat")}</DropdownMenuShortcut></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={remove} className="text-danger focus:text-danger"><Trash2 /> Delete<DropdownMenuShortcut>{itemKeyLabel("remove")}</DropdownMenuShortcut></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              }
              properties={taskProperties(task)}
            />

            {error && <p role="alert" className="px-5 py-2 text-xs text-danger border-b border-border">{error}</p>}

            {editing && <TaskEditForm key={`edit-${task.id}`} task={task} rootParam={rootParam} onDone={() => setEditingId(null)} />}

            {/* Quick actions (none in the read-only demo) */}
            {!demo && <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => { onMove(task.id, s); onClose() }}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
                >
                  <StatusIcon status={s as Task["status"]} className="size-3" /> {STATUS_LABELS[s] || s}
                </button>
              ))}
              <button
                onClick={() => { onClose(); showAbout({ kind: "task", id: task.id }) }}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-accent text-accent-fg transition-[filter] hover:brightness-110"
              >
                <MessageSquare className="size-3.5" /> {chat ? "Open chat" : "Chat about task"}
              </button>
            </div>}

            {task.status === "review" && !demo && <ReviewActions key={`review-${task.id}`} taskId={task.id} onDone={onClose} />}

            {/* Body, then activity: one scroll area */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4">
                {task.raw ? (
                  <MarkdownRenderer content={bodyOf(task.raw)} />
                ) : (
                  <p className="text-sm text-muted">No content available.</p>
                )}
              </div>
              <section aria-label="Activity" className="border-t border-border">
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
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** "R002 › T002": the epic links to its sheet on the roadmap, like the epic sheet's "Now › R002". */
function TaskCrumb({ task, onNavigate }: { task: Task; onNavigate: () => void }) {
  const epic = task.phase && task.phase !== "—" ? epicOf(task.phase) : null
  return (
    <>
      {epic?.id && (
        <>
          <Link href={`/roadmap?item=${epic.id}`} onClick={onNavigate} title={epic.title} className="hover:text-txt">{epic.id}</Link>
          <ChevronRight className="size-3 shrink-0" aria-hidden />
        </>
      )}
      <span>{task.id}</span>
      <AgentMark attach={{ kind: "task", id: task.id }} />
    </>
  )
}

/** The file without its H1 and **Key:** block: the header already shows those. */
function bodyOf(raw: string): string {
  const lines = raw.split("\n")
  let i = lines.findIndex((l) => l.startsWith("# "))
  i = i < 0 ? 0 : i + 1
  while (i < lines.length && (lines[i].trim() === "" || /^\*\*[^*]+:\*\*/.test(lines[i]))) i++
  return lines.slice(i).join("\n")
}

/** Status · owner · due · size · epic, in the shared header grid. */
function taskProperties(task: Task): ItemProperty[] {
  const epic = task.phase && task.phase !== "—" ? epicOf(task.phase) : null
  return [
    { label: "Status", icon: CircleDashed, value: <TaskStatusField task={task} chip /> },
    { label: "Priority", icon: Flag, value: <TaskPriorityField task={task} /> },
    { label: "Owner", icon: User, value: <TaskOwnerField task={task} /> },
    { label: "Due", icon: Calendar, value: <TaskDueField task={task}>{task.due ? <DueChip due={task.due} state={dueState(task.due, task.status === "done" ? "done" : "planned", localToday())} /> : <span className="text-muted">—</span>}</TaskDueField> },
    { label: "Size", icon: Ruler, value: <TaskSizeField task={task} /> },
    { label: "Epic", icon: MapIcon, value: epic && <span className="flex min-w-0 items-center gap-1.5">{epic.id && <span className="font-mono text-[11px] text-muted">{epic.id}</span>}<span className="truncate">{epic.title}</span></span> },
  ]
}

const FIELD = "w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-txt focus:border-accent/60 focus:outline-hidden"

/** Title and meta fields; sends only what changed, so the body and other fields stay as they are. */
function TaskEditForm({ task, rootParam, onDone }: { task: Task; rootParam: string; onDone: () => void }) {
  const [base] = useState(task)
  const [title, setTitle] = useState(task.title)
  const [size, setSize] = useState(task.size === "—" ? "" : task.size)
  const [phase, setPhase] = useState(task.phase === "—" ? "" : task.phase)
  const [dependsOn, setDependsOn] = useState(task.dependsOn === "—" ? "" : task.dependsOn)
  const [due, setDue] = useState(task.due ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orDash = (v: string) => (v.trim() === "—" ? "" : v.trim())

  async function save() {
    const patch: TaskMetaPatch = {}
    if (title.trim() && title.trim() !== base.title) patch.title = title
    if (size.trim() !== orDash(base.size)) patch.size = size
    if (phase.trim() !== orDash(base.phase)) patch.phase = phase
    if (dependsOn.trim() !== orDash(base.dependsOn)) patch.dependsOn = dependsOn
    if ((due || null) !== base.due) patch.due = due || null
    if (Object.keys(patch).length === 0) return onDone()
    setBusy(true)
    setError(null)
    try {
      await updateTask(task.id, patch, rootParam)
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save() }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onDone() } }}
      className="flex flex-col gap-3 px-5 py-4 border-b border-border shrink-0 bg-surface2/40"
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        Title
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Size
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="S / M / L" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(FIELD, "scheme-light dark:scheme-dark")} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Epic / phase
        <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="R054 — Item actions" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Depends on
        <input value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} placeholder="T001, T002" className={cn(FIELD, "font-mono")} />
      </label>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="text-xs px-2.5 py-1 rounded-sm bg-accent text-accent-fg transition-[filter] hover:brightness-110 disabled:opacity-40">Save</button>
        <button type="button" onClick={onDone} disabled={busy} className="text-xs text-muted hover:text-txt">Cancel</button>
      </div>
    </form>
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
