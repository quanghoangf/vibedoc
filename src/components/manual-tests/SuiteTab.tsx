"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, Loader2, Play, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { isSuiteRunning, type SuiteState, type SuiteTask } from "@/lib/suite"
import { useSuiteRun } from "./useSuiteRun"
import { useTestRun } from "./useTestRun"
import { FlakyChip } from "./TestEvidence"
import { TEST_REVIEW_KEYS } from "@/lib/shortcuts"
import type { RunManifest } from "@/lib/runs-paths"

const clock = (ms: number) => (ms < 60_000 ? `${(Math.max(0, ms) / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`)
const evidenceHref = (taskId: string) => `/manual-tests?tab=all&task=${taskId}&view=evidence`

/**
 * /manual-tests?tab=suite (R064): every done task's spec in one run. Live rows while it goes; afterwards the
 * broken tasks first (failing step, error, screenshot, Open evidence), the passed ones folded below.
 */
export function SuiteTab({ specs, withoutSpec }: { specs: number; withoutSpec: number }) {
  const { demo } = useApp()
  const { suite, busy, start, stop } = useSuiteRun()
  const single = useTestRun()
  const blocked = single.busy ? `${single.run?.taskId ?? "A task"} is running` : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4 sm:px-7">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold text-txt">Regression suite</h2>
          <p className="text-xs text-muted">
            <span className="font-mono tabular-nums text-txt">{specs}</span> {specs === 1 ? "spec" : "specs"} from done tasks
            {withoutSpec > 0 && <> · <span className="font-mono tabular-nums">{withoutSpec}</span> done {withoutSpec === 1 ? "task" : "tasks"} without a spec</>}
          </p>
        </div>
        {!demo && (
          <button
            type="button"
            data-suite
            onClick={() => void (busy ? stop() : start())}
            disabled={!busy && (!!blocked || specs === 0)}
            title={busy ? `Stop the suite (${TEST_REVIEW_KEYS.suite.key})` : blocked ?? (specs === 0 ? "No done task has a spec yet" : `Run every done task's spec (${TEST_REVIEW_KEYS.suite.key})`)}
            className={cn(
              "ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40",
              busy ? "border-danger/40 text-danger hover:bg-danger/10" : "border-accent/40 bg-accent/10 text-txt hover:bg-accent/20",
            )}
          >
            {busy ? <><Square className="size-3" aria-hidden /> Stop</> : <><Play className="size-3.5" aria-hidden /> Run suite</>}
          </button>
        )}
      </div>
      {suite ? <SuiteResult suite={suite} /> : (
        <p className="px-5 py-8 text-sm text-muted sm:px-7">
          No suite run yet. Run suite replays the spec of every done task, so a change that breaks an old feature shows up here with the task that owned it.
        </p>
      )}
    </div>
  )
}

function SuiteResult({ suite }: { suite: SuiteState }) {
  const going = isSuiteRunning(suite)
  const total = suite.tasks.length
  const ended = suite.tasks.filter((t) => t.status === "passed" || t.status === "flaky" || t.status === "failed").length
  const broken = suite.tasks.filter((t) => t.status === "failed")
  // R065: flaky tasks passed (on a retry): listed with the passed ones, labelled, never counted as broken
  const passed = suite.tasks.filter((t) => t.status === "passed" || t.status === "flaky")
  const flaky = suite.tasks.filter((t) => t.status === "flaky").length
  const flakyNote = flaky ? ` · ${flaky} flaky` : ""
  const elapsed = suite.endedAt ? Date.parse(suite.endedAt) - Date.parse(suite.startedAt) : null

  const headline = suite.state === "starting" ? "Starting the app…"
    : suite.state === "running" ? `Running · ${ended}/${total} tasks`
    : suite.state === "passed" ? `Passed · ${total}/${total} tasks${flakyNote}`
    : suite.state === "failed" ? `Failed · ${broken.length} of ${total} ${total === 1 ? "task" : "tasks"} broke${flakyNote}`
    : suite.state === "cancelled" ? `Stopped · ${ended}/${total} tasks ran`
    : "Couldn’t run the suite"

  return (
    <div aria-live="polite" className="flex flex-col gap-4 px-5 py-5 sm:px-7">
      <p className={cn("flex items-center gap-2 text-[13px] font-medium", suite.state === "failed" || suite.state === "error" ? "text-danger" : suite.state === "cancelled" ? "text-muted" : "text-txt")}>
        {going ? <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
          : suite.state === "passed" ? <Check className="size-4 text-teal" strokeWidth={2.5} aria-hidden />
          : suite.state === "cancelled" ? <Square className="size-3.5" aria-hidden />
          : <X className="size-4" strokeWidth={2.5} aria-hidden />}
        {headline}
        {elapsed !== null && <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{clock(elapsed)}</span>}
      </p>

      {suite.state === "error" && (
        <div className="flex flex-col gap-1.5">
          {suite.error && <p className="text-xs text-danger">{suite.error}</p>}
          {suite.tail && <pre className="max-h-56 overflow-auto rounded-md border border-border bg-bg p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted">{suite.tail.split("\n").slice(-20).join("\n")}</pre>}
        </div>
      )}

      {going ? (
        <ol aria-label="Suite tasks" className="flex flex-col">{suite.tasks.map((t) => <TaskRow key={t.taskId} task={t} />)}</ol>
      ) : (
        <>
          {broken.length > 0 && (
            <section aria-label="Broken tasks" className="flex flex-col gap-3">
              {broken.map((t) => <Broken key={t.taskId} task={t} startedAt={suite.startedAt} />)}
            </section>
          )}
          {passed.length > 0 && (
            <details open={!broken.length} className="group">
              <summary className="cursor-pointer text-xs text-muted hover:text-txt">
                <span className="font-mono tabular-nums">{passed.length}</span> passed{flaky > 0 && <span className="text-amber"> ({flaky} flaky)</span>}
              </summary>
              <ol aria-label="Passed tasks" className="mt-1 flex flex-col">{passed.map((t) => <TaskRow key={t.taskId} task={t} />)}</ol>
            </details>
          )}
          {suite.tasks.some((t) => t.status === "queued" || t.status === "running") && (
            <p className="text-xs text-muted">{suite.tasks.filter((t) => t.status === "queued" || t.status === "running").map((t) => t.taskId).join(", ")}: not reached</p>
          )}
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: SuiteTask["status"] }) {
  return status === "running" ? <Loader2 className="size-4 animate-spin text-accent" aria-label="running" />
    : status === "flaky" ? <Check className="size-4 text-amber" strokeWidth={2.5} aria-label="passed on a retry" />
    : status === "passed" ? <Check className="size-4 text-teal" strokeWidth={2.5} aria-label="passed" />
    : status === "failed" ? <X className="size-4 text-danger" strokeWidth={2.5} aria-label="failed" />
    : <span className="size-4 rounded-full border border-border2" aria-label="queued" />
}

function TaskRow({ task: t }: { task: SuiteTask }) {
  return (
    <li className="grid grid-cols-[1rem_3.25rem_1fr_auto] items-center gap-x-2 py-1.5 text-sm">
      <StatusIcon status={t.status} />
      <span className="font-mono text-[11px] text-muted">{t.taskId}</span>
      <span className="flex min-w-0 items-center gap-2"><span className="truncate text-txt" title={t.title}>{t.title}</span>{t.status === "flaky" && <FlakyChip />}</span>
      <span className="font-mono text-[11px] text-muted tabular-nums">
        {t.status === "failed" && t.failedStep ? `step ${t.failedStep.index}` : t.steps ? `${t.passed}/${t.steps}` : ""}
      </span>
    </li>
  )
}

/** A broken task: its failing step, the error's first line and that step's screenshot from the newest run. */
function Broken({ task: t, startedAt }: { task: SuiteTask; startedAt: string }) {
  const { rootParam } = useApp()
  const [shot, setShot] = useState<string | null>(null)
  const step = t.failedStep
  useEffect(() => {
    if (!step) return
    let live = true
    fetch(`/api/tasks/${encodeURIComponent(t.taskId)}/runs${rootParam}`)
      .then((r) => r.json())
      .then((d) => {
        const run = (d?.runs as RunManifest[] | undefined)?.find((r) => r.startedAt >= startedAt)
        const file = run?.steps.find((s) => s.index === step.index)?.screenshot
        if (live && run && file) setShot(`/api/tasks/${encodeURIComponent(t.taskId)}/runs/${run.runId}/${encodeURIComponent(file)}${rootParam}`)
      })
      .catch(() => {})
    return () => { live = false }
  }, [t.taskId, step, startedAt, rootParam])

  return (
    <article className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 sm:flex-row sm:items-start">
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API
        <img src={shot} alt={`Screenshot of ${t.taskId} step ${step?.index}`} className="w-full shrink-0 rounded-sm border border-border object-cover object-top sm:h-24 sm:w-40" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="font-mono text-[11px] text-muted">{t.taskId}</span>
          <span className="truncate font-medium text-txt" title={t.title}>{t.title}</span>
        </p>
        {step && <p className="text-xs text-txt"><span className="font-mono text-danger">Step {step.index}</span> {step.name}</p>}
        {step?.error && <p className="font-mono text-xs break-words whitespace-pre-wrap text-danger">{step.error}</p>}
        <Link href={evidenceHref(t.taskId)} className="mt-1 inline-flex w-fit items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-txt transition-colors hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
          Open evidence <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  )
}
