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
import { TestEvidence, UnverifiedChip } from "./TestEvidence"
import { RunLive } from "./RunLive"
import { useTestRun } from "./useTestRun"
import { useSuiteRun } from "./useSuiteRun"
import { isRunning } from "@/lib/test-run-events"
import type { ManualTestItem, ManualTests } from "@/lib/manual-tests"
import { sendBackNote, stepParts, type ReviewRow } from "@/lib/test-review"
import { REVIEWABLE } from "@/lib/review"
import { TEST_REVIEW_KEYS } from "@/lib/shortcuts"
import type { Task } from "@/types"
import { useT } from "@/context/LanguageContext"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import { useReviewText } from "./review-text"

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
  const { t } = useT()
  // Kept runs, reported by the evidence view: `[` `]` only show when there is another run to step to
  const items = tests?.items ?? []
  const manual = items.filter((i) => !i.auto)
  const automated = items.filter((i) => i.auto)
  const groups = [
    { id: "steps", label: t("tests.colManual"), items: manual.filter((i) => i.group === "steps") },
    { id: "regression", label: t("tests.regression"), items: manual.filter((i) => i.group === "regression") },
  ].filter((g) => g.items.length)
  // R062: in the Evidence view a task in review is decided on top of the proof, not in the bottom bar
  const reviewHere = view === "evidence" && task.status === "review" && !demo
  const failedStep = task.lastRun?.status === "failed" ? task.lastRun.failed : null
  const failedNote = failedStep ? sendBackNote(failedStep) : ""
  // R061: this task's Run from VibeDoc (live, or just finished until dismissed)
  const testRun = useTestRun()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const mine = testRun.run?.taskId === task.id ? testRun.run : null
  const going = isRunning(mine)
  const showRun = mine && mine.startedAt !== dismissed ? mine : null
  const suiteRun = useSuiteRun()
  const otherRun = suiteRun.busy ? t("board.theSuite") : testRun.busy && !mine ? testRun.run!.taskId : null
  // A run in progress re-proves the automated items: until it ends, only its live results count
  const proven = row.auto.result === "passed" && !row.unverified && !going
  const liveStatus = (item: ManualTestItem) => mine?.steps.find((s) => s.name.trim().replace(/\s+/g, " ") === item.text.trim().replace(/\s+/g, " "))?.status
  const decides = !demo && (row.result === "failed" || task.status === "review")

  const line = (item: ManualTestItem, number: string, readOnly = false) => {
    // Live marks only while the run goes; after it, the task file (ticks, Auto header) is the record
    const live = item.auto && going ? liveStatus(item) : undefined
    const checked = checkedOf(item) || (readOnly && proven) || live === "passed"
    return (
      <li key={item.index}>
        <label className={cn("-mx-2 grid grid-cols-[1rem_1.25rem_1fr] items-start gap-x-2.5 rounded-md px-2 py-2", !readOnly && "cursor-pointer hover:bg-surface2")}>
          {live === "running" ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" aria-label={t("tests.runningNow")} />
            : live === "passed" ? <Check className="mt-0.5 size-4 text-teal" strokeWidth={2.5} aria-label={t("tests.passedInRun")} />
            : live === "failed" ? <X className="mt-0.5 size-4 text-danger" strokeWidth={2.5} aria-label={t("tests.failedInRun")} />
            : readOnly
            ? <Bot className="mt-0.5 size-4 text-teal" aria-label={t("tests.provenByRun")} />
            : <Tick checked={checked} onChange={(c) => onToggle(item, c)} />}
          <span className="mt-px font-mono text-[11px] leading-5 text-muted tabular-nums" aria-hidden>{number}</span>
          <span className="flex min-w-0 items-start gap-2">
            <StepText text={item.text} checked={checked} />
            {/* R063: the last pass didn't prove this 🤖 item, so it waits for a human */}
            {item.auto && !checked && !live && row.result === "passed" && row.unverified > 0 && <UnverifiedChip reasons={[t("tests.didntProve")]} />}
          </span>
        </label>
      </li>
    )
  }

  return (
    <article key={task.id} aria-label={t("tests.testReviewOf", { id: task.id })} className={cn("flex min-h-full flex-col animate-fade-in", expanded && "mx-auto w-full max-w-5xl")}>
      <header className="flex flex-col gap-3 border-b border-border px-5 pt-4 pb-5 sm:px-7">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          {expanded && (
            <button type="button" onClick={() => onExpand(false)} className="-ml-1 mr-1 hidden min-h-6 items-center gap-1 rounded-sm px-1 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent lg:inline-flex">
              <ArrowLeft className="size-3.5" aria-hidden /> {t("tests.allTests")}
            </button>
          )}
          <button type="button" onClick={onBack} className="-ml-1 mr-1 inline-flex min-h-6 items-center gap-1 rounded-sm px-1 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent lg:hidden">
            <ArrowLeft className="size-3.5" aria-hidden /> {t("tests.back")}
          </button>
          {row.epic.id && <Link href={`/roadmap?item=${row.epic.id}`} className="inline-flex min-h-6 items-center rounded-sm hover:text-txt focus-visible:outline-2 focus-visible:outline-accent" title={row.epic.name}>{row.epic.id}</Link>}
          {row.epic.id && <span aria-hidden>›</span>}
          <span>{task.id}</span>
          <span className="ml-auto hidden items-center gap-1 lg:inline-flex">
            <button
              type="button"
              onClick={() => onExpand(!expanded)}
              aria-pressed={expanded}
              aria-label={expanded ? t("tests.collapseToList") : t("tests.openAsPage")}
              title={expanded ? t("tests.collapseKey") : t("tests.openAsPageKey")}
              className={ICON_BTN}
            >
              {expanded ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={onClose} aria-label={t("shell.close")} title={t("tests.closeEsc")} className={ICON_BTN}>
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </div>
        <h2 data-user-content className="text-[1.1rem] leading-snug font-semibold text-balance text-txt">{task.title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusChip status={displayStatus(task)} />
          <Link
            href={`/board?task=${task.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-txt transition-colors hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t("tests.openTask")} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          {tests?.spec && !demo && (
            <button
              type="button"
              data-run
              onClick={() => void (going ? testRun.stop() : testRun.start(task.id))}
              disabled={!!otherRun}
              title={otherRun ? t("board.isRunning", { name: otherRun }) : going ? t("tests.stopRunKey", { key: TEST_REVIEW_KEYS.run.key }) : t("tests.runSpecKey", { key: TEST_REVIEW_KEYS.run.key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40",
                going ? "border-danger/40 text-danger hover:bg-danger/10" : "border-accent/40 bg-accent/10 text-txt hover:bg-accent/20",
              )}
            >
              {going ? <><Square className="size-3" aria-hidden /> {t("board.stop")}</> : <><Play className="size-3.5" aria-hidden /> {t("tests.runTests")}</>}
            </button>
          )}
          {tests?.spec && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted" title={t("tests.playwrightSpec")}>
              <FileCode2 className="size-3.5 shrink-0" aria-hidden />
              <code className="truncate font-mono select-all">{tests.spec}</code>
            </span>
          )}
        </div>
        {/* A two-segment control (DESIGN.md): pressed buttons, not tabs */}
        <div role="group" aria-label={t("memory.view")} className="flex w-fit items-center gap-0.5 rounded-md border border-border bg-bg p-0.5">
          {(["review", "evidence"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              title={t(v === "review" ? "tests.viewReviewTitle" : "tests.viewEvidenceTitle", { key: TEST_REVIEW_KEYS.view.key })}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-accent",
                view === v ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {v === "review" ? t("tests.viewReview") : t("tests.viewEvidence")}
            </button>
          ))}
        </div>
      </header>

      {/* The live Run strip shows in both views: a task in review opens on Evidence, where Run is pressed too */}
      {showRun && (
        <section aria-label={t("tests.liveRun")} className="border-b border-border px-5 py-5 sm:px-7">
          <RunLive run={showRun} began={testRun.began} ended={testRun.ended} unverified={row.unverified} onDismiss={() => setDismissed(showRun.startedAt)} />
        </section>
      )}
      {view === "evidence" ? (
        <section aria-label={t("tests.evidence")} className="px-5 py-5 sm:px-7">
          <TestEvidence
            key={task.id}
            taskId={task.id}
            latest={task.lastRun?.runId ?? null}
            run={run}
            onRun={onRun}
            onReplay={() => onView("review")}
            review={reviewHere ? { initialNote: failedNote, onDecided } : undefined}
          />
        </section>
      ) : <>
      {!going && (
        <section aria-label={t("board.pickRun")} className="border-b border-border px-5 py-5 sm:px-7">
          <RunPlayer key={task.id} taskId={task.id} latest={task.lastRun?.runId ?? null} />
        </section>
      )}

      <section aria-label={t("tests.checklist")} className="flex flex-col gap-5 px-5 py-5 sm:px-7">
        {!items.length ? <p className="text-sm text-muted">{t("tests.noChecklist")}</p> : (
          <p className="-mb-2 text-xs leading-relaxed text-muted">
            {t("tests.tickingSaves")}
            {tests?.date && <> {t("tests.reportFrom")} <span className="font-mono text-[11px]">{tests.date}</span>.</>}
          </p>
        )}
        {automated.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-medium text-txt">
              {t("tests.automated")} <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{automated.length}</span>
              <span className={cn("text-xs font-normal", going ? "text-accent" : proven ? "text-teal" : row.auto.result === "failed" ? "text-danger" : "")}>
                {going ? t("tests.autoRunningNow") : proven ? t("tests.autoProven") : row.result === "passed" && row.unverified ? t("tests.autoUnverified", { n: row.unverified }) : row.auto.result === "failed" ? t("tests.autoFailed") : t("tests.autoNotRun")}
              </span>
            </h3>
            <ol className="flex flex-col">{/* A passed run proves them; until then a human can still tick them */}
              {automated.map((item) => line(item, "", proven))}</ol>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1">
            <h3 className={cn("flex items-baseline gap-x-1.5 text-[13px] font-medium", g.id === "steps" ? "text-txt" : "text-amber")}>
              {g.label} <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{g.items.filter(checkedOf).length}/{g.items.length}</span>
            </h3>
            <ol className="flex flex-col">
              {/* Steps are a sequence; regression checks aren't */}
              {g.items.map((item, n) => line(item, g.id === "steps" ? String(n + 1).padStart(2, "0") : ""))}
            </ol>
          </div>
        ))}
      </section>
      </>}

      {decides && !reviewHere && <Decision task={task} row={row} onDecided={onDecided} />}
    </article>
  )
}

const ICON_BTN = "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent"

const OPEN_TASK = "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-txt transition-colors hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"

/**
 * The decision bar, pinned to the bottom of the detail so it's read after the run and the checklist: a failed
 * last run (any status) or a task in review. Send back works from review or done (REVIEWABLE); a failed run on a
 * task the agent still holds only links to it.
 */
function Decision({ task, row, onDecided }: { task: Task; row: ReviewRow; onDecided: () => void }) {
  const { t } = useT()
  const statusLabel = useStatusLabel()
  const { outstanding } = useReviewText()
  const failedRun = row.result === "failed"
  const step = task.lastRun?.status === "failed" ? task.lastRun.failed : null
  const openTask = <Link href={`/board?task=${task.id}`} className={OPEN_TASK}>{t("tests.openTask")} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
  const prompt = (
    <div className="flex min-w-0 flex-col gap-0.5">
      {failedRun ? (
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-danger">
          <X className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="shrink-0">{step ? t("tests.lastRunFailedAtStep", { n: step.index }) : t("tests.lastRunFailed")}</span>
          {step && <><span className="text-muted" aria-hidden>·</span><span className="truncate font-normal text-txt" title={step.name}>{step.name}</span></>}
        </p>
      ) : <p className="text-[13px] font-medium text-txt">{t("tests.waitingYourReview")}</p>}
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
          <span className="text-[11px] text-muted">{t("tests.itsStatus", { status: statusLabel(task.status).toLowerCase() })}</span>
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
  const { t } = useT()
  return (
    <span data-user-content className={cn("flex min-w-0 flex-col gap-1 transition-colors duration-(--duration-base)", checked ? "text-muted line-through" : "text-txt")}>
      <span className="text-sm leading-snug"><Inline text={action} /></span>
      {expected && (
        <span className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">{t("tests.expected")} </span>
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
