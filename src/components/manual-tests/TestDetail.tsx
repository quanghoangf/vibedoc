"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, FileCode2, Loader2, Maximize2, Minimize2, Play, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { displayStatus } from "@/lib/statuses"
import { StatusChip } from "@/components/shared/StatusIcon"
import { ReviewActions } from "@/components/board/TaskDetailPanel"
import { RunPlayer } from "./RunPlayer"
import { TestEvidence } from "./TestEvidence"
import { RunLive } from "./RunLive"
import { useTestRun } from "./useTestRun"
import { isRunning } from "@/lib/test-run-events"
import type { ManualTestItem, ManualTests } from "@/lib/manual-tests"
import { outstanding, sendBackNote, stepParts, type ReviewRow } from "@/lib/test-review"
import { REVIEWABLE } from "@/lib/review"
import { TEST_REVIEW_KEYS } from "@/lib/shortcuts"
import type { Task } from "@/types"

export type DetailView = "review" | "evidence"

/**
 * The right pane of /manual-tests: one task's run replay, its checklist and the review decision (Review view), or
 * its evidence doc with the run history (Evidence view, R060).
 */
export function TestDetail({ task, tests, row, checkedOf, onToggle, onBack, onDecided, expanded, onExpand, onClose, view, onView, run, onRun }: {
  task: Task
  tests: ManualTests | null
  row: ReviewRow
  checkedOf: (item: ManualTestItem) => boolean
  onToggle: (item: ManualTestItem, checked: boolean) => void
  onBack: () => void
  /** After approve / send back: the page moves on to the next row that needs you */
  onDecided: () => void
  /** Open as a page: the list folds away and the task takes the width (?full=1) */
  expanded: boolean
  onExpand: (expanded: boolean) => void
  /** Close the panel (wide screens): the list takes the width again */
  onClose: () => void
  /** ?view=evidence */
  view: DetailView
  onView: (view: DetailView) => void
  /** ?run=: the kept run the evidence details (null = newest) */
  run: string | null
  onRun: (runId: string | null) => void
}) {
  const { demo } = useApp()
  const items = tests?.items ?? []
  const manual = items.filter((i) => !i.auto)
  const automated = items.filter((i) => i.auto)
  const groups = [
    { label: "Steps", items: manual.filter((i) => i.group === "steps") },
    { label: "Regression risk", items: manual.filter((i) => i.group === "regression") },
  ].filter((g) => g.items.length)
  // R061: this task's Run from VibeDoc (live, or just finished until dismissed)
  const testRun = useTestRun()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const mine = testRun.run?.taskId === task.id ? testRun.run : null
  const going = isRunning(mine)
  const showRun = mine && mine.startedAt !== dismissed ? mine : null
  const otherRun = testRun.busy && !mine ? testRun.run!.taskId : null
  // A run in progress re-proves the automated items: until it ends, only its live results count
  const proven = row.auto.result === "passed" && !going
  const liveStatus = (item: ManualTestItem) => mine?.steps.find((s) => s.name.trim().replace(/\s+/g, " ") === item.text.trim().replace(/\s+/g, " "))?.status
  const decides = !demo && (row.result === "failed" || task.status === "review")

  const line = (item: ManualTestItem, number: string, readOnly = false) => {
    const live = item.auto ? liveStatus(item) : undefined
    const checked = checkedOf(item) || (readOnly && proven) || live === "passed"
    return (
      <li key={item.index}>
        <label className={cn("-mx-2 grid grid-cols-[1rem_1.25rem_1fr] items-start gap-x-2.5 rounded-md px-2 py-2", !readOnly && "cursor-pointer hover:bg-surface2")}>
          {live === "running" ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" aria-label="Running now" />
            : live === "passed" ? <Check className="mt-0.5 size-4 text-teal" strokeWidth={2.5} aria-label="Passed in this run" />
            : live === "failed" ? <X className="mt-0.5 size-4 text-danger" strokeWidth={2.5} aria-label="Failed in this run" />
            : readOnly
            ? <Bot className="mt-0.5 size-4 text-teal" aria-label="Proven by the last run" />
            : <Tick checked={checked} onChange={(c) => onToggle(item, c)} />}
          <span className="mt-px font-mono text-[11px] leading-5 text-muted tabular-nums" aria-hidden>{number}</span>
          <StepText text={item.text} checked={checked} />
        </label>
      </li>
    )
  }

  return (
    <article key={task.id} aria-label={`${task.id} test review`} className={cn("flex min-h-full flex-col animate-fade-in", expanded && "mx-auto w-full max-w-5xl")}>
      <header className="flex flex-col gap-3 border-b border-border px-5 pt-4 pb-5 sm:px-7">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          {expanded && (
            <button type="button" onClick={() => onExpand(false)} className="-ml-1 mr-1 hidden min-h-6 items-center gap-1 rounded-sm px-1 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent lg:inline-flex">
              <ArrowLeft className="size-3.5" aria-hidden /> All tests
            </button>
          )}
          <button type="button" onClick={onBack} className="-ml-1 mr-1 inline-flex min-h-6 items-center gap-1 rounded-sm px-1 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent lg:hidden">
            <ArrowLeft className="size-3.5" aria-hidden /> Back
          </button>
          {row.epic.id && <Link href={`/roadmap?item=${row.epic.id}`} className="inline-flex min-h-6 items-center rounded-sm hover:text-txt focus-visible:outline-2 focus-visible:outline-accent" title={row.epic.name}>{row.epic.id}</Link>}
          {row.epic.id && <span aria-hidden>›</span>}
          <span>{task.id}</span>
          <span className="ml-auto hidden items-center gap-1 lg:inline-flex">
            <button
              type="button"
              onClick={() => onExpand(!expanded)}
              aria-pressed={expanded}
              aria-label={expanded ? "Collapse back to the list" : "Open as a page"}
              title={expanded ? "Collapse back to the list (o)" : "Open as a page (o)"}
              className={ICON_BTN}
            >
              {expanded ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={ICON_BTN}>
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </div>
        <h2 className="text-[1.1rem] leading-snug font-semibold text-balance text-txt">{task.title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusChip status={displayStatus(task)} />
          <Link
            href={`/board?task=${task.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-txt transition-colors hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            Open task <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          {tests?.spec && !demo && (
            <button
              type="button"
              data-run
              onClick={() => void (going ? testRun.stop() : testRun.start(task.id))}
              disabled={!!otherRun}
              title={otherRun ? `${otherRun} is running` : going ? `Stop the run (${TEST_REVIEW_KEYS.run.key})` : `Run this task's spec now (${TEST_REVIEW_KEYS.run.key})`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40",
                going ? "border-danger/40 text-danger hover:bg-danger/10" : "border-accent/40 bg-accent/10 text-txt hover:bg-accent/20",
              )}
            >
              {going ? <><Square className="size-3" aria-hidden /> Stop</> : <><Play className="size-3.5" aria-hidden /> Run tests</>}
            </button>
          )}
          {tests?.spec && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted" title="Playwright spec">
              <FileCode2 className="size-3.5 shrink-0" aria-hidden />
              <code className="truncate font-mono select-all">{tests.spec}</code>
            </span>
          )}
        </div>
        <div role="tablist" aria-label="View" className="flex w-fit items-center gap-0.5 rounded-md border border-border bg-bg p-0.5">
          {(["review", "evidence"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onView(v)}
              title={`${v === "review" ? "Run replay and checklist" : "The evidence doc and run history"} (${TEST_REVIEW_KEYS.view.key})`}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs capitalize transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-accent",
                view === v ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <KeyStrip
          view={view}
          tick={view === "review" && !demo && manual.some((i) => !checkedOf(i))}
          approve={decides && task.status === "review"}
          sendBack={decides && REVIEWABLE["changes requested"].includes(task.status)}
        />
      </header>

      {view === "evidence" ? (
        <section aria-label="Evidence" className="px-5 py-5 sm:px-7">
          <TestEvidence key={task.id} taskId={task.id} latest={task.lastRun?.runId ?? null} run={run} onRun={onRun} />
        </section>
      ) : <>
      {showRun && (
        <section aria-label="Live run" className="border-b border-border px-5 py-5 sm:px-7">
          <RunLive run={showRun} began={testRun.began} ended={testRun.ended} onDismiss={() => setDismissed(showRun.startedAt)} />
        </section>
      )}
      {!going && (
        <section aria-label="Run" className="border-b border-border px-5 py-5 sm:px-7">
          <RunPlayer key={task.id} taskId={task.id} latest={task.lastRun?.runId ?? null} />
        </section>
      )}

      <section aria-label="Checklist" className="flex flex-col gap-5 px-5 py-5 sm:px-7">
        {!items.length ? <p className="text-sm text-muted">This task has no checklist. The run above is the whole record.</p> : (
          <p className="-mb-2 text-xs leading-relaxed text-muted">
            Ticking saves to the task file and never changes the status.
            {tests?.date && <> Report from <span className="font-mono text-[11px]">{tests.date}</span>.</>}
          </p>
        )}
        {automated.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-medium text-txt">
              Automated <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{automated.length}</span>
              <span className={cn("text-xs font-normal", going ? "text-accent" : proven ? "text-teal" : row.auto.result === "failed" ? "text-danger" : "")}>
                {going ? "· running now" : proven ? "· proven by the last run" : row.auto.result === "failed" ? "· the last run failed" : "· not run yet"}
              </span>
            </h3>
            <ol className="flex flex-col">{/* A passed run proves them; until then a human can still tick them */}
              {automated.map((item) => line(item, "", proven))}</ol>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <h3 className={cn("flex items-baseline gap-x-1.5 text-[13px] font-medium", g.label === "Steps" ? "text-txt" : "text-amber")}>
              {g.label === "Steps" ? "Manual" : g.label} <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{g.items.filter(checkedOf).length}/{g.items.length}</span>
            </h3>
            <ol className="flex flex-col">
              {/* Steps are a sequence; regression checks aren't */}
              {g.items.map((item, n) => line(item, g.label === "Steps" ? String(n + 1).padStart(2, "0") : ""))}
            </ol>
          </div>
        ))}
      </section>
      </>}

      {decides && <Decision task={task} row={row} onDecided={onDecided} />}
    </article>
  )
}

const ICON_BTN = "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent"

const KBD = "rounded-sm border border-border2 bg-surface2 px-1 py-0.5 font-mono text-[11px] leading-none text-txt"

/** The page keys that apply to this task, for sighted keyboard users (the `?` sheet lists them all). */
function KeyStrip({ view, tick, approve, sendBack }: { view: DetailView; tick: boolean; approve: boolean; sendBack: boolean }) {
  const K = TEST_REVIEW_KEYS
  const keys: [string, string][] = [
    ["j", ""], ["k", "move"],
    ...(tick ? [[K.tick.key, "tick"]] as [string, string][] : []),
    ...(approve ? [[K.approve.key, "twice to approve"]] as [string, string][] : []),
    ...(sendBack ? [[K.sendBack.key, "send back"]] as [string, string][] : []),
    [K.failed.key, "next failed"],
    [K.run.key, "run"],
    [K.view.key, view === "review" ? "evidence" : "review"],
    [K.expand.key, "page"],
    ...(view === "review" ? [["space", "play"]] as [string, string][] : []),
  ]
  return (
    <p aria-hidden className="flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-[11px] text-muted max-sm:hidden">
      {keys.map(([k, label], i) => (
        <span key={k} className="inline-flex items-center gap-1">
          <kbd className={KBD}>{k}</kbd>{label}{label && i < keys.length - 1 && <span className="px-0.5" aria-hidden>·</span>}
        </span>
      ))}
    </p>
  )
}

const OPEN_TASK = "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-txt transition-colors hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"

/**
 * The decision bar, pinned to the bottom of the detail so it's read after the run and the checklist: a failed
 * last run (any status) or a task in review. Send back works from review or done (REVIEWABLE); a failed run on a
 * task the agent still holds only links to it.
 */
function Decision({ task, row, onDecided }: { task: Task; row: ReviewRow; onDecided: () => void }) {
  const failedRun = row.result === "failed"
  const step = task.lastRun?.status === "failed" ? task.lastRun.failed : null
  const openTask = <Link href={`/board?task=${task.id}`} className={OPEN_TASK}>Open task <ArrowUpRight className="size-3.5" aria-hidden /></Link>
  const prompt = (
    <div className="flex min-w-0 flex-col gap-0.5">
      {failedRun ? (
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-danger">
          <X className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="shrink-0">Last run failed{step && ` at step ${step.index}`}</span>
          {step && <><span className="text-muted" aria-hidden>·</span><span className="truncate font-normal text-txt" title={step.name}>{step.name}</span></>}
        </p>
      ) : <p className="text-[13px] font-medium text-txt">Waiting for your review</p>}
      {/* A failed headline already names the run; then only the checks are news */}
      <p className="text-xs text-muted">{failedRun ? outstanding(row)[0] : outstanding(row).join(" · ")}</p>
    </div>
  )
  const bar = "sticky bottom-0 z-10 mt-auto border-t border-b-0 border-border bg-surface px-5 py-3 shadow-[0_-8px_16px_-14px_rgb(0_0_0/0.6)] sm:px-7"

  if (!REVIEWABLE["changes requested"].includes(task.status)) {
    return (
      <div className={cn(bar, "flex flex-col gap-2")}>
        {prompt}
        <div className="flex flex-wrap items-center gap-2">
          {openTask}
          <span className="text-[11px] text-muted">It&apos;s {task.status}; the agent sees the failure on its next run.</span>
        </div>
      </div>
    )
  }
  return (
    <ReviewActions
      taskId={task.id}
      onDone={onDecided}
      canApprove={task.status === "review"}
      initialNote={step ? sendBackNote(step) : ""}
      prompt={prompt}
      className={bar}
    >
      {openTask}
    </ReviewActions>
  )
}

// Paths, commands, files, IDs and tool names inside a step (the Grep rule: set them in mono)
const CODE = /((?<=^|[\s(])\/[\w\-./#?=]+|\b[a-z][\w-]+\/[\w\-./]*\w|\b[\w-]+\.(?:md|json|tsx?|mts)\b|\b(?:[TR]\d{3}|ADR-\d{3})\b|\bvibedoc_\w+|\bmanualTests\b)/g

const MONO = "font-mono text-[0.9em]"
const mono = (text: string) => text.split(CODE).map((part, i) => i % 2 ? <code key={i} className={MONO}>{part}</code> : part)

/** Markdown `code` and **bold** first (backticks dropped, emoji stripped), then the Grep mono rule on the rest. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {stepParts(text).map((p, i) =>
        p.kind === "code" ? <code key={i} className={MONO}>{p.text}</code>
          : p.kind === "strong" ? <strong key={i} className="font-semibold">{mono(p.text)}</strong>
          : <span key={i}>{mono(p.text)}</span>,
      )}
    </>
  )
}

/** A step reads "do this → see that": the action, then the expected result on its own line. */
function StepText({ text, checked }: { text: string; checked: boolean }) {
  const at = text.indexOf(" → ")
  const action = at < 0 ? text : text.slice(0, at)
  const expected = at < 0 ? null : text.slice(at + 3)
  return (
    <span className={cn("flex min-w-0 flex-col gap-1 transition-colors duration-(--duration-base)", checked ? "text-muted line-through" : "text-txt")}>
      <span className="text-sm leading-snug"><Inline text={action} /></span>
      {expected && (
        <span className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Expected: </span>
          <span><Inline text={expected} /></span>
        </span>
      )}
    </span>
  )
}

/** The native checkbox, drawn in the system: pencil-grey box, teal fill with an ink check when ticked. */
export function Tick({ checked, onChange, className }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const { demo } = useApp() // read-only demo (R042): shown, not tickable
  return (
    <span className={cn("relative mt-0.5 flex size-4 shrink-0", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={demo}
        onChange={(e) => onChange(e.target.checked)}
        className="peer size-4 cursor-pointer disabled:cursor-default appearance-none rounded-sm border border-muted bg-bg transition-colors duration-(--duration-fast) checked:border-teal checked:bg-teal hover:border-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <Check strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-3 text-accent-fg opacity-0 peer-checked:opacity-100" aria-hidden />
    </span>
  )
}
