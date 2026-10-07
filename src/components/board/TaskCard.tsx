"use client"

import { useState } from "react"
import Link from "next/link"
import { Bot, Check, CornerDownRight, CornerUpLeft, FlaskConical, Loader2, MoreHorizontal, PanelRightOpen, Play, ScanSearch, Trash2, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApp } from "@/context/AppContext"
import { deleteTaskWithUndo } from "./task-api"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { TaskDueField, TaskOwnerField, TaskSizeField } from "./TaskFields"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { QuickReviewButton } from "./QuickReview"
import { useTestRun } from "@/components/manual-tests/useTestRun"
import { useSuiteRun } from "@/components/manual-tests/useSuiteRun"
import { isRunning } from "@/lib/test-run-events"
import { testReviewHref } from "@/lib/test-review"
import { testChipTone } from "@/components/docs/DocTests"
import type { Task } from "@/types"
import { AgentDot } from "@/components/chat/AgentMark"
import { latestReview, summarizeMarks } from "@/lib/review"
import { blockingCount } from "@/lib/verification"
import { verifyTask } from "@/lib/ask-agent"
import { epicOf, sizeOf, type PropertyKey } from "@/lib/board-views"
import { useT } from "@/context/LanguageContext"

const ALL_PROPERTIES: PropertyKey[] = ["status", "epic", "size", "due", "deps", "tests", "agent", "owner"]

interface TaskCardProps {
  task: Task
  onOpen: () => void
  /** Which lines show; defaults to every property. */
  properties?: PropertyKey[]
  selected?: boolean
  /** Shift / Cmd / Ctrl-click toggles selection instead of opening */
  onSelect?: () => void
}

/**
 * A task on the board. The column already says the status, so the card doesn't repeat it.
 * Click (or Enter) opens the task panel, where every action lives; drag moves it between columns.
 */
export function TaskCard({ task, onOpen, properties = ALL_PROPERTIES, selected = false, onSelect }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const { demo, playground } = useApp()
  const { t, tn } = useT()
  const show = (p: PropertyKey) => properties.includes(p)
  const epic = show("epic") && task.phase ? epicOf(task.phase) : null
  const sentBack = task.status === "todo" && task.raw ? latestReview(task.raw) : null
  // R065: the automatic fixes ran out; a human decides now
  const needsHuman = task.status === "review" && !!task.raw && latestReview(task.raw)?.outcome === "auto fix limit reached"
  const size = show("size") ? sizeOf(task) : null
  const done = task.status === "done" || task.status === "cancelled"
  const deps = show("deps") ? task.dependsOn.match(/\bT\d+\b/g) ?? [] : []
  const tests = show("tests") ? task.manualTests : null
  const changesRequested = sentBack?.outcome === "changes requested"
  // R062: a send back with flagged steps says how many, and names them on hover
  const marked = changesRequested && sentBack.marks.length ? summarizeMarks(sentBack.marks) : null
  // R067: critical + major verification findings
  const findings = blockingCount(task.verification ?? null)

  return (
    <div
      draggable={!demo}
      role="button"
      tabIndex={0}
      aria-label={`${task.id} ${task.title}`}
      aria-pressed={onSelect ? selected : undefined}
      onClick={(e) => { if (onSelect && (e.shiftKey || e.metaKey || e.ctrlKey)) onSelect(); else onOpen() }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id)
        e.dataTransfer.effectAllowed = "move"
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{ viewTransitionName: `task-${task.file.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-left outline-hidden",
        "transition-[border-color,background-color,opacity,box-shadow] duration-(--duration-fast)",
        "hover:border-border2 hover:bg-surface2/50 focus-visible:border-accent/60 focus-visible:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.15)]",
        isDragging && "cursor-grabbing opacity-50",
        selected && "border-accent bg-accent/5 hover:border-accent",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span>{task.id}</span>
        {show("agent") && <AgentDot attach={{ kind: "task", id: task.id }} />}
        {show("owner") && task.owner && (
          <TaskOwnerField task={task}><OwnerChip owner={task.owner} className="text-[10px] [&_svg]:size-3" /></TaskOwnerField>
        )}
        <span className="flex-1" />
        {show("due") && task.due && !done && <TaskDueField task={task}><span title={t("board.due")}>{task.due.slice(5)}</span></TaskDueField>}
        {size && <TaskSizeField task={task}><span title={task.size} className="rounded-sm bg-surface2 px-1 text-[10px]">{size}</span></TaskSizeField>}
        {task.status === "review" && !demo && !playground && <CardVerify taskId={task.id} />}
        {!demo && <CardMenu task={task} onOpen={onOpen} />}
      </div>

      <p className={cn("mt-1 line-clamp-2 text-[13px] font-medium leading-snug", done ? "text-muted" : "text-txt")}>{task.title}</p>

      {(epic || changesRequested || needsHuman || findings > 0 || deps.length > 0 || tests || (task.status === "review" && !demo)) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {epic && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-muted" title={task.phase}>
              {epic.id && <span className="font-mono text-[10px]">{epic.id}</span>}
              <span className="truncate">{epic.title}</span>
            </span>
          )}
          {changesRequested && (
            <span
              title={marked
                ? t("board.flagged", { steps: [...marked.steps, ...(marked.more ? [t("board.moreSteps", { n: marked.more })] : [])].join(" · ") })
                : sentBack?.note}
              className="inline-flex items-center gap-1 rounded-sm border border-amber/40 bg-amber/5 px-1.5 py-0.5 text-[10px] text-amber"
            >
              <CornerUpLeft className="size-3" aria-hidden /> {t("board.changesRequested")}
              {marked && <> · {tn("board.steps", marked.failed + marked.doubt)}</>}
            </span>
          )}
          {needsHuman && (
            <span title={t("board.needsHumanTitle")} className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-danger/5 px-1.5 py-0.5 text-[10px] text-danger">
              <CornerUpLeft className="size-3" aria-hidden /> {t("board.needsHuman")}
            </span>
          )}
          {findings > 0 && (
            <span
              title={t("board.verificationCounts", {
                critical: task.verification?.findings.filter((f) => f.severity === "critical").length ?? 0,
                major: task.verification?.findings.filter((f) => f.severity === "major").length ?? 0,
              })}
              className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-danger/5 px-1.5 py-0.5 text-[10px] text-danger"
            >
              <ScanSearch className="size-3" aria-hidden /> {tn("board.findings", findings)}
            </span>
          )}
          {task.status === "review" && task.lastRun && (
            <Link
              href={testReviewHref(task.id, "evidence")}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
              title={t("board.lastRunEvidence")}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-accent/50",
                task.lastRun.status !== "passed" ? "border-danger/40 text-danger"
                  : tests?.autoRun?.flaky ? "border-amber/40 bg-amber/5 text-amber"
                  : "border-teal/30 bg-teal/5 text-teal",
              )}
            >
              {task.lastRun.status === "passed"
                ? <><Check className="size-3" aria-hidden /> {task.lastRun.passed}/{task.lastRun.steps}{tests?.autoRun?.flaky ? ` · ${t("board.flakyCount", { n: tests.autoRun.flaky })}` : ""}</>
                : <><X className="size-3" aria-hidden /> {t("board.failedCount", { n: task.lastRun.steps - task.lastRun.passed })}</>}
            </Link>
          )}
          {deps.length > 0 && (
            <span title={t("board.dependsOnIds", { ids: deps.join(", ") })} className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
              <CornerDownRight className="size-3" aria-label={t("board.dependsOn")} />
              {deps.join(", ")}
            </span>
          )}
          {tests && (
            <Link
              href={testReviewHref(task.id, "evidence")}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation() /* the card's Enter would open the panel instead */}
              onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
              title={t("board.testsTicked", { done: tests.done, total: tests.total }) +
                (tests.auto ? `, ${t("board.testsAutomated", { n: tests.auto })}` : "") +
                (tests.autoRun ? ` (${t("board.testsLastRun", { result: tests.autoRun.result === "failed" ? t("board.runFailed") : t("board.runPassed"), date: tests.autoRun.date })}${tests.autoRun.flaky ? `, ${t("board.flakyCount", { n: tests.autoRun.flaky })}` : ""})` : "") +
                ` · ${t("board.testsEvidence")}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-accent/50",
                testChipTone(tests), // the same tones as a task doc's chip in /docs (T507)
              )}
            >
              <FlaskConical className="size-3" aria-hidden />
              {tests.done}/{tests.total}
              {tests.auto > 0 && <> · <Bot className="size-3" aria-hidden />{tests.auto}</>}
              {tests.autoRun?.result === "failed" && <span className="size-1.5 rounded-full bg-danger" aria-label={t("board.lastAutoRunFailed")} />}
            </Link>
          )}
          {tests?.spec && !demo && !playground && <CardRun taskId={task.id} />}
          <QuickReviewButton task={task} />
        </div>
      )}
    </div>
  )
}

/**
 * R061: play on the card (hover / focus; a spinner while this task runs). Events stop here so the card neither
 * opens nor drags. Disabled while another task of the project runs.
 */
function CardRun({ taskId }: { taskId: string }) {
  const testRun = useTestRun()
  const running = testRun.run?.taskId === taskId && isRunning(testRun.run)
  const suiteRun = useSuiteRun()
  const { t } = useT()
  const other = suiteRun.busy ? t("board.theSuite") : testRun.busy && !running ? testRun.run!.taskId : null
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <button
      type="button"
      draggable={false}
      onClick={(e) => { e.stopPropagation(); void (running ? testRun.stop() : testRun.start(taskId)) }}
      onKeyDown={stop}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
      disabled={!!other}
      aria-label={running ? t("board.stopTests", { id: taskId }) : t("board.runTests", { id: taskId })}
      title={other ? t("board.isRunning", { name: other }) : running ? t("board.runningClickToStop") : t("board.runSpecNow")}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-sm text-muted transition-[opacity,color] hover:text-accent focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
        running ? "text-accent opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
      )}
    >
      {running ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Play className="size-3" aria-hidden />}
    </button>
  )
}

/** R067: Verify on a card in review (on hover / focus): a new agent chat checks it and reports findings. */
function CardVerify({ taskId }: { taskId: string }) {
  const { t } = useT()
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <button
      type="button"
      draggable={false}
      onClick={(e) => { e.stopPropagation(); verifyTask(taskId) }}
      onKeyDown={stop}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
      aria-label={t("board.verifyId", { id: taskId })}
      title={t("board.verifyTitle")}
      className="inline-flex size-5 items-center justify-center rounded-sm text-muted opacity-0 transition-[opacity,color] hover:text-accent group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ScanSearch className="size-3" aria-hidden />
    </button>
  )
}

/** ⋯ on the card (on hover / focus). Events are stopped so the card doesn't open or drag underneath. */
function CardMenu({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          draggable={false}
          aria-label={t("board.actionsFor", { id: task.id })}
          onClick={stop}
          onKeyDown={stop}
          className="-my-1 -mr-1 grid size-5 place-items-center rounded-sm text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-txt focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      {/* React events bubble through the portal to the card: stop them here */}
      <DropdownMenuContent align="end" className="w-40" onClick={stop} onKeyDown={stop}>
        <DropdownMenuItem onSelect={onOpen}><PanelRightOpen /> {t("board.open")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => { deleteTaskWithUndo(task, rootParam).catch((e: Error) => toast(e.message)) }}
          className="text-danger focus:text-danger"
        >
          <Trash2 /> {t("board.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
