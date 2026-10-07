"use client"

import { useRef, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import type { Task } from "@/types"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { TaskSessions } from "./TaskSessions"
import { TaskRuns } from "./TaskRuns"
import Link from "next/link"
import { Bot, Calendar, Check, ChevronRight, Copy, CircleDashed, CornerUpLeft, FileText, Flag, FlaskConical, Map as MapIcon, ListChecks, MessageSquare, MoreHorizontal, Ruler, ScanSearch, Trash2, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useStatusDefs } from "@/components/shared/status-defs"
import { displayStatus } from "@/lib/statuses"
import { ItemPanelHeader, type ItemProperty } from "@/components/shared/ItemPanelHeader"
import { TaskDueField, TaskOwnerField, TaskPriorityField, TaskSizeField, TaskStatusField } from "./TaskFields"
import { epicOf } from "@/lib/board-views"
import { localToday, dueState } from "@/lib/roadmap-health"
import { DueChip } from "@/components/roadmap/RoadmapNodes"
import { itemKeyLabel, useItemCommands } from "@/components/shared/item-commands"
import { deleteTaskWithUndo } from "./task-api"
import { AgentMark } from "@/components/chat/AgentMark"
import { useApp } from "@/context/AppContext"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/context/ChatContext"
import { chatFor } from "@/lib/chats"
import { latestReview, reviewHistory, type ReviewEntry, type ReviewMark } from "@/lib/review"
import { SEVERITIES, formatFindingsNote, type Verification } from "@/lib/verification"
import { verifyTask } from "@/lib/ask-agent"
import { testReviewHref } from "@/lib/test-review"
import type { AutoRun } from "@/lib/manual-tests"
import { useT } from "@/context/LanguageContext"
import { readCookie } from "@/lib/player-prefs"
import { clampPanelWidth, panelWidthCookie, parsePanelWidth, PANEL_DEFAULT_WIDTH, PANEL_KEYBOARD_STEP, PANEL_MIN_WIDTH, PANEL_WIDTH_COOKIE } from "@/lib/panel-width"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import type { MessageKey } from "@/i18n"

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

const STATUS_LABELS: Record<string, MessageKey> = {
  "in-progress": "board.moveStart",
  review: "board.moveReview",
  done: "board.moveDone",
  blocked: "board.moveBlocked",
  paused: "board.movePause",
  todo: "board.moveBacklog",
  cancelled: "board.moveCancel",
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

  const { t } = useT()
  // Drag the left edge (or ←/→ on it) to resize; the width is remembered per browser in a cookie
  // read on first render: the sheet's content only mounts in the browser, so there's no server markup to mismatch
  const [width, setWidth] = useState(() => typeof document === "undefined"
    ? PANEL_DEFAULT_WIDTH
    : clampPanelWidth(parsePanelWidth(readCookie(document.cookie, PANEL_WIDTH_COOKIE)), window.innerWidth))
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const resizeTo = (w: number) => {
    const next = clampPanelWidth(w, window.innerWidth)
    setWidth(next)
    document.cookie = panelWidthCookie(next)
  }

  return (
    <Sheet open={!!openTask} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        style={{ "--panel-w": `${width}px` } as CSSProperties}
        className="p-0 gap-0 sm:w-(--panel-w) sm:max-w-none border-border flex flex-col"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("board.resizeTaskPanel")}
          aria-valuenow={width}
          aria-valuemin={PANEL_MIN_WIDTH}
          tabIndex={0}
          data-panel-resize
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            dragRef.current = { startX: e.clientX, startWidth: width }
          }}
          // the edge is on the left: dragging left widens the panel
          onPointerMove={(e) => { if (dragRef.current) resizeTo(dragRef.current.startWidth - (e.clientX - dragRef.current.startX)) }}
          onPointerUp={() => { dragRef.current = null }}
          onDoubleClick={() => resizeTo(PANEL_DEFAULT_WIDTH)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); resizeTo(width + PANEL_KEYBOARD_STEP) }
            else if (e.key === "ArrowRight") { e.preventDefault(); resizeTo(width - PANEL_KEYBOARD_STEP) }
          }}
          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize max-sm:hidden after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-accent/60 focus-visible:outline-none focus-visible:after:bg-accent active:after:bg-accent"
        />
        {task && <TaskDetailBody task={task} active={!!openTask} onClose={onClose} onMove={onMove} title={(text) => <SheetTitle className="text-base font-semibold leading-snug text-txt">{text}</SheetTitle>} />}
      </SheetContent>
    </Sheet>
  )
}

/**
 * A task's detail (header, fields, quick actions, review, body, tests, runs, sessions) without a frame:
 * the board's sheet wraps it, /roadmap shows it inline next to the epic pane (T508).
 * `onClose` runs when the user leaves the task (a move, a link elsewhere, a chat).
 */
export function TaskDetailBody({ task, onClose, onMove, active = true, title }: {
  task: Task
  onClose: () => void
  onMove: (id: string, status: string) => void
  /** false while a sheet slides out: its item keys / ⌘K commands are dropped */
  active?: boolean
  /** The title element (a Sheet passes its SheetTitle); default an h2 */
  title?: (text: string) => ReactNode
}) {
  const nextStatuses = NEXT_STATUS[task.status] || []
  const { chats, showAbout } = useChats()
  const { rootParam, demo, openDoc } = useApp()
  const chat = chatFor(chats, { kind: "task", id: task.id })
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const statusDefs = useStatusDefs()
  const statusLabel = useStatusLabel()
  const { t } = useT()
  const chatAbout = () => { onClose(); showAbout({ kind: "task", id: task.id }) }
  const openFull = () => { onClose(); void openDoc(task.file) }
  useItemCommands(active ? `${task.id} · ${task.title}` : null, [
    { action: "open", label: t("board.openFullDoc"), run: openFull },
    { action: "status", label: t("board.changeStatus"), run: () => setMenuOpen(true) },
    { action: "chat", label: t("board.chatAboutTask"), run: chatAbout },
    { action: "remove", label: t("board.delete"), run: () => { remove() } },
  ])

  async function remove() {
    setError(null)
    try {
      await deleteTaskWithUndo(task, rootParam)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <ItemPanelHeader
        kicker={<TaskCrumb task={task} onNavigate={onClose} />}
        title={title ? title(task.title) : <h2 className="text-base font-semibold leading-snug text-txt">{task.title}</h2>}
        menu={<div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={openFull}
            aria-label={t("board.openFullDoc")}
            title={`${t("board.openFullDoc")} (${itemKeyLabel("open")})`}
            data-open-full-doc
            className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt"
          >
            <FileText className="size-4" aria-hidden />
          </button>
          {!demo &&
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("board.actionsFor", { id: task.id })} className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={openFull}><FileText /> {t("board.openFullDoc")}<DropdownMenuShortcut>{itemKeyLabel("open")}</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><StatusIcon status={displayStatus(task)} /> {t("board.status")}<DropdownMenuShortcut>{itemKeyLabel("status")}</DropdownMenuShortcut></DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {statusDefs.map((d) => (
                      <DropdownMenuItem key={d.id} disabled={d.id === displayStatus(task)} onSelect={() => onMove(task.id, d.id)}>
                        <StatusIcon status={d.id} /> {statusLabel(d.id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onSelect={chatAbout}><MessageSquare /> {t("board.chatAboutTask")}<DropdownMenuShortcut>{itemKeyLabel("chat")}</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={remove} className="text-danger focus:text-danger"><Trash2 /> {t("board.delete")}<DropdownMenuShortcut>{itemKeyLabel("remove")}</DropdownMenuShortcut></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
        </div>}
        properties={taskProperties(task, t)}
      />

      {error && <p role="alert" className="px-5 py-2 text-xs text-danger border-b border-border">{error}</p>}

      {/* Quick actions (none in the read-only demo) */}
      {!demo && <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border shrink-0">
        {nextStatuses.map((s) => (
          <button
            key={s}
            onClick={() => { onMove(task.id, s); onClose() }}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
          >
            <StatusIcon status={s as Task["status"]} className="size-3" /> {STATUS_LABELS[s] ? t(STATUS_LABELS[s]) : s}
          </button>
        ))}
        {(task.status === "review" || task.status === "done") && (
          <button
            onClick={() => verifyTask(task.id)}
            title={t("board.verifyPanelTitle")}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
          >
            <ScanSearch className="size-3.5" /> {t("board.verify")}
          </button>
        )}
        <button
          onClick={() => { onClose(); showAbout({ kind: "task", id: task.id }) }}
          className={cn(task.status !== "review" && task.status !== "done" && "ml-auto", " inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-accent text-accent-fg transition-[filter] hover:brightness-110")}
        >
          <MessageSquare className="size-3.5" /> {chat ? t("board.openChat") : t("board.chatAboutTask")}
        </button>
      </div>}

      {task.status === "review" && !demo && (
        <ReviewActions
          key={`review-${task.id}`}
          taskId={task.id}
          onDone={onClose}
          prompt={latestReview(task.raw ?? "")?.outcome === "auto fix limit reached" ? (
            <p className="text-xs text-danger">
              <span className="font-medium">{t("board.needsHumanLead")}</span> {t("board.needsHumanBody", { n: latestReview(task.raw ?? "")?.attempts ?? "" })}
            </p>
          ) : undefined}
        >
          {/* R062: decide from the proof */}
          <Link
            href={testReviewHref(task.id, "evidence")}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-sm border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs text-txt transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("board.openEvidence")}
          </Link>
        </ReviewActions>
      )}

      {/* Body, then activity: one scroll area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4">
          {task.raw ? (
            <MarkdownRenderer content={bodyOf(task.raw)} basePath={task.file} />
          ) : (
            <p className="text-sm text-muted">{t("board.noContent")}</p>
          )}
        </div>
        <section aria-label={t("shell.activity")} className="border-t border-border">
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
              {t("board.manualTestsTicked")}
              {task.manualTests.auto > 0 && (
                <span className="inline-flex items-center gap-1"><span aria-hidden>·</span><Bot className="size-3.5" aria-hidden /><span className="font-mono">{task.manualTests.auto}</span> {t("board.automated")}</span>
              )}
              <span className="ml-auto text-accent opacity-0 transition-opacity group-hover:opacity-100">{t("board.openChecklist")}</span>
            </Link>
          )}
          {task.manualTests && (task.manualTests.spec || task.manualTests.autoRun) && (
            <AutoTestsLine spec={task.manualTests.spec} autoRun={task.manualTests.autoRun} />
          )}

          {task.verification && (
            <VerificationBlock
              key={`verify-${task.id}-${task.verification.at}-${task.verification.findings.length}`}
              taskId={task.id}
              verification={task.verification}
              canSendBack={!demo && (task.status === "review" || task.status === "done")}
              onSent={onClose}
            />
          )}

          <TaskRuns key={`runs-${task.id}`} taskId={task.id} latest={task.lastRun?.runId ?? null} spec={task.manualTests?.spec ?? null} onNavigate={onClose} />

          <ReviewHistory entries={reviewHistory(task.raw ?? "")} />

          <TaskSessions key={task.id} taskId={task.id} onNavigate={onClose} />
        </section>
      </div>
    </>
  )
}

/** "Spec: `path` · last run passed 2026-10-04" (R058). The spec lives in the target repo, so the path is copied, not linked. */
function AutoTestsLine({ spec, autoRun }: { spec: string | null; autoRun: AutoRun | null }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!spec) return
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked: the path stays selectable
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-2 border-b border-border text-xs text-muted">
      {spec && (
        <span className="inline-flex min-w-0 items-center gap-1">
          {t("board.spec")} <code className="select-all truncate font-mono text-txt">{spec}</code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? t("board.copied") : t("board.copyPath", { path: spec })}
            className="rounded-sm p-1 hover:bg-surface2 hover:text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
          </button>
          <span className="sr-only" role="status">{copied ? t("board.copiedToClipboard") : ""}</span>
        </span>
      )}
      {spec && autoRun && <span aria-hidden>·</span>}
      {autoRun && (
        <span>
          {t("board.lastRun")} <span className={cn("font-mono", autoRun.result === "failed" ? "text-danger" : "text-teal")}>{autoRun.result === "failed" ? t("board.runFailed") : t("board.runPassed")}</span>{" "}
          <span className="font-mono">{autoRun.date}</span>
        </span>
      )}
    </div>
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
function taskProperties(task: Task, t: (key: MessageKey) => string): ItemProperty[] {
  const epic = task.phase && task.phase !== "—" ? epicOf(task.phase) : null
  return [
    { label: t("board.status"), id: "status", icon: CircleDashed, value: <TaskStatusField task={task} chip /> },
    { label: t("board.priority"), id: "priority", icon: Flag, value: <TaskPriorityField task={task} /> },
    { label: t("board.owner"), id: "owner", icon: User, value: <TaskOwnerField task={task} /> },
    { label: t("board.due"), id: "due", icon: Calendar, value: <TaskDueField task={task}>{task.due ? <DueChip due={task.due} state={dueState(task.due, task.status === "done" ? "done" : "planned", localToday())} /> : <span className="text-muted">—</span>}</TaskDueField> },
    { label: t("board.size"), id: "size", icon: Ruler, value: <TaskSizeField task={task} /> },
    { label: t("board.epic"), id: "epic", icon: MapIcon, value: epic && <span className="flex min-w-0 items-center gap-1.5">{epic.id && <span className="font-mono text-[11px] text-muted">{epic.id}</span>}<span className="truncate">{epic.title}</span></span> },
    // R068: the epic scenarios this task covers (read-only; edit the **Covers:** line)
    ...(task.covers?.length ? [{ label: t("board.covers"), id: "covers", icon: ListChecks, value: (
      <span className="flex flex-wrap gap-1">{task.covers.map((id) => <span key={id} className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">{id}</span>)}</span>
    ) }] : []),
  ]
}



export type ReviewAction = "approve" | "send-back"

/**
 * Approve (→ done) or send back with a note (→ todo) a task waiting in Review. /manual-tests also uses it for a
 * failed run on a done task: `canApprove={false}`, the note prefilled from the failed step, its own `prompt`
 * line, and `children` (Open task) at the end of the button row. A toast confirms the outcome.
 */
export function ReviewActions({ taskId, onDone, canApprove = true, initialNote = "", prompt, className, children, runId, marks, marksList, confirmApprove }: {
  taskId: string
  onDone: (action: ReviewAction) => void
  canApprove?: boolean
  initialNote?: string
  prompt?: ReactNode
  className?: string
  children?: ReactNode
  /** R062: the run the decision is made from, written into the entry */
  runId?: string | null
  /** R062: flagged steps sent with Send back; with one or more the note may stay empty */
  marks?: ReviewMark[]
  /** R062: shown above the note while sending back (the flagged steps) */
  marksList?: ReactNode
  /** R062: Approve asks this first ("Approve with 2 doubts?") */
  confirmApprove?: string | null
}) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [sendingBack, setSendingBack] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState(initialNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flagged = marks?.length ?? 0

  async function act(action: ReviewAction) {
    setBusy(true)
    setError(null)
    setConfirming(false)
    try {
      const res = await fetch(`/api/tasks/review${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, action, note, ...(runId ? { runId } : {}), ...(action === "send-back" && flagged ? { marks } : {}) }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t("board.requestFailed", { status: res.status }))
      toast(action === "approve" ? t("board.approvedToast", { id: taskId }) : t("board.sentBackToast", { id: taskId }))
      setSendingBack(false)
      setNote(initialNote)
      setBusy(false)
      onDone(action)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 px-5 py-3 border-b border-border shrink-0 bg-accent/5", className)}>
      {prompt ?? <p className="text-xs text-muted">{t("board.waitingReview")}</p>}
      {sendingBack ? (
        <div className="flex flex-col gap-2 animate-fade-in">
          {marksList}
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={initialNote ? Math.min(6, initialNote.split("\n").length + 1) : 3}
            placeholder={flagged ? t("board.notePlaceholderFlagged") : t("board.notePlaceholder")}
            aria-label={t("board.sendBackNote")}
            className="w-full resize-y rounded-md border border-border bg-bg px-2.5 py-2 text-sm text-txt placeholder:text-muted focus:border-accent/60 focus:outline-hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => act("send-back")}
              disabled={busy || (!note.trim() && !flagged)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-amber/15 border border-amber/40 text-amber transition-colors hover:bg-amber/25 disabled:opacity-40"
            >
              <CornerUpLeft className="size-3.5" aria-hidden /> {busy ? t("board.sendingBack") : t("board.sendBack")}
            </button>
            <button onClick={() => { setSendingBack(false); setNote(initialNote) }} disabled={busy} className="text-xs text-muted hover:text-txt">{t("board.cancel")}</button>
            <span className="text-[11px] text-muted">{t("board.sendBackHint")}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && confirming && (
            <span role="alert" className="flex flex-wrap items-center gap-2 text-xs text-amber">
              {confirmApprove}
              <button onClick={() => act("approve")} disabled={busy} className="rounded-sm border border-teal/40 bg-teal/15 px-2 py-0.5 text-teal hover:bg-teal/25">{t("board.approveAnyway")}</button>
              <button onClick={() => setConfirming(false)} className="text-muted hover:text-txt">{t("board.cancel")}</button>
            </span>
          )}
          {canApprove && !confirming && (
            <button
              data-review="approve"
              onClick={() => (confirmApprove ? setConfirming(true) : act("approve"))}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-teal/15 border border-teal/40 text-teal transition-colors hover:bg-teal/25 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Check className="size-3.5" aria-hidden /> {t("board.approve")}
            </button>
          )}
          <button
            data-review="send-back"
            onClick={() => setSendingBack(true)}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm border transition-colors",
              canApprove ? "bg-surface2 border-border text-muted hover:text-txt hover:border-border2" : "bg-amber/15 border-amber/40 text-amber hover:bg-amber/25",
            )}
          >
            <CornerUpLeft className="size-3.5" aria-hidden /> {canApprove ? t("board.sendBackEllipsis") : t("board.sendBackToAgent")}
          </button>
          {children}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
}

const SEVERITY_STYLE = { critical: "text-danger", major: "text-amber", minor: "text-muted" } as const
const SEVERITY_KEY = { critical: "board.sevCritical", major: "board.sevMajor", minor: "board.sevMinor" } as const

/** R067: what an agent found the task gets wrong against what was asked, grouped by severity. */
function VerificationBlock({ taskId, verification: v, canSendBack, onSent }: { taskId: string; verification: Verification; canSendBack: boolean; onSent: () => void }) {
  const { rootParam } = useApp()
  const { t, tn } = useT()
  // critical + major start checked: those are the ones worth a fix request
  const [picked, setPicked] = useState(() => new Set(v.findings.flatMap((f, i) => (f.severity === "minor" ? [] : [i]))))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pickable = canSendBack && !v.outdated && v.findings.length > 0
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })

  async function sendBack() {
    setBusy(true)
    setError(null)
    try {
      const note = formatFindingsNote(v.findings.filter((_, i) => picked.has(i)))
      const res = await fetch(`/api/tasks/review${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, action: "send-back", note }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t("board.requestFailed", { status: res.status }))
      toast(tn("board.sentBackFindings", picked.size, { id: taskId }))
      onSent()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <section aria-label={t("board.verification")} className="flex flex-col gap-2 px-5 py-3 border-b border-border shrink-0">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
        {t("board.verification")}
        <span className="normal-case tracking-normal">{v.at} · {v.by}{v.sha ? ` · at ${v.sha}` : ""}</span>
        {v.outdated && <span className="normal-case tracking-normal text-amber">{t("board.outdated")}</span>}
      </p>
      {!v.findings.length && <p className="text-xs text-teal">{t("board.verifiedNothing")}</p>}
      <div className={cn("flex flex-col gap-2", v.outdated && "opacity-60")}>
        {SEVERITIES.map((sev) => {
          const rows = v.findings.map((f, i) => ({ f, i })).filter(({ f }) => f.severity === sev)
          if (!rows.length) return null
          return (
            <div key={sev} className="flex flex-col gap-1">
              <p className={cn("text-xs font-medium capitalize", v.outdated ? "text-muted" : SEVERITY_STYLE[sev])}>{t(SEVERITY_KEY[sev])} · {rows.length}</p>
              <ul className="flex flex-col gap-1.5">
                {rows.map(({ f, i }) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {pickable && (
                      <input
                        type="checkbox"
                        checked={picked.has(i)}
                        onChange={() => toggle(i)}
                        aria-label={t("board.sendBackCriterion", { criterion: f.criterion })}
                        className="mt-0.5 size-3.5 shrink-0 accent-[rgb(var(--rgb-accent))]"
                      />
                    )}
                    <span className="flex flex-col gap-0.5">
                      <span className="text-txt">{f.criterion}</span>
                      <span className="text-muted">{f.message}{f.file && <> · <code className="font-mono text-[11px]">{f.file}</code></>}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {pickable && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sendBack}
            disabled={busy || !picked.size}
            className="inline-flex items-center gap-1.5 rounded-sm border border-amber/40 bg-amber/5 px-2.5 py-1 text-xs text-amber transition-colors hover:bg-amber/10 disabled:opacity-50"
          >
            <CornerUpLeft className="size-3.5" aria-hidden /> {tn("board.sendBackFindings", picked.size)}
          </button>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  )
}

/** Past review outcomes, newest first. */
function ReviewHistory({ entries }: { entries: ReviewEntry[] }) {
  const { t } = useT()
  if (!entries.length) return null
  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border shrink-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{t("board.reviewHistory")}</p>
      <ul className="flex flex-col gap-2">
        {[...entries].reverse().map((e, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-xs">
              <span className={cn("font-medium", e.outcome === "approved" || e.outcome === "auto run passed" ? "text-teal" : e.outcome === "auto fix limit reached" ? "text-danger" : "text-amber")}>
                {e.outcome === "approved" ? t("board.outApproved")
                  : e.outcome === "auto run passed" ? t("board.outRunPassed")
                  : e.outcome === "auto fix limit reached" ? t("board.outNeedsHuman", { n: e.attempts ?? "" })
                  : e.auto ? t("board.outChangesAuto") : t("board.outChanges")}
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
