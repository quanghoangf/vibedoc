"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isRunning, type RunState } from "@/lib/test-run-events"
import { FlakyChip, UnverifiedChip } from "./TestEvidence"

const clock = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`

/**
 * A Run from VibeDoc as it happens (R061): "Starting the app…", then each step with a spinner / check / cross and
 * its elapsed time; once it ends, the verdict (and the output tail when Playwright itself failed).
 * `began` / `ended`: client times per step index (useTestRun).
 */
export function RunLive({ run, began, ended, unverified = 0, onStop, onDismiss }: {
  run: RunState
  began: Record<number, number>
  ended: Record<number, number>
  /** R063: unverified steps the finished run left (the task's Auto header, once written) */
  unverified?: number
  /** A Stop in the strip, for frames without their own Run/Stop control */
  onStop?: () => void
  onDismiss: () => void
}) {
  const going = isRunning(run)
  // The running step's clock ticks; finished steps read their stamped end
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!going) return
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [going])
  const failedStep = run.steps.find((s) => s.status === "failed")
  const passed = run.steps.filter((s) => s.status === "passed").length
  const total = run.finishedAt ? Date.parse(run.finishedAt) - Date.parse(run.startedAt) : null

  const blank = new Set(run.blankPassed ?? [])
  const weak = Math.max(unverified, blank.size)
  const headline = going
    ? run.state === "starting" ? "Starting the app…" : run.state === "checking" ? "Checking the test is honest…" : `Running · step ${run.steps.length}`
    : run.state === "passed" ? `Passed · ${passed}/${run.steps.length} steps${weak ? ` · ${weak} unverified` : ""}${run.flaky ? ` · ${run.flaky} flaky` : ""}`
    : run.state === "failed" ? `Failed${failedStep ? ` at step ${failedStep.index}` : ""}`
    : run.state === "cancelled" ? "Stopped"
    : "Couldn’t run the spec"

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {going ? <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
          : run.state === "passed" ? <Check className="size-4 shrink-0 text-teal" strokeWidth={2.5} aria-hidden />
          : run.state === "cancelled" ? <Square className="size-3.5 shrink-0 text-muted" aria-hidden />
          : <X className="size-4 shrink-0 text-danger" strokeWidth={2.5} aria-hidden />}
        <p className={cn("text-[13px] font-medium", run.state === "failed" || run.state === "error" ? "text-danger" : run.state === "cancelled" ? "text-muted" : "text-txt")}>{headline}</p>
        {total !== null && <span className="font-mono text-[11px] text-muted tabular-nums">{clock(total)}</span>}
        <span className="ml-auto" />
        {going ? onStop && (
          <button type="button" onClick={onStop} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-txt transition-colors hover:border-danger/50 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent">
            <Square className="size-3" aria-hidden /> Stop
          </button>
        ) : (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" title="Dismiss" className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent">
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {run.steps.length > 0 && (
        <ol className="flex flex-col">
          {run.steps.map((s) => (
            <li key={s.index} className="grid grid-cols-[1rem_1.5rem_1fr_auto] items-start gap-x-2 py-1 text-sm">
              {s.status === "running" ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" aria-label="running" />
                : s.status === "passed" && s.retried ? <Check className="mt-0.5 size-4 text-amber" strokeWidth={2.5} aria-label="passed on retry" />
                : s.status === "passed" ? <Check className="mt-0.5 size-4 text-teal" strokeWidth={2.5} aria-label="passed" />
                : <X className="mt-0.5 size-4 text-danger" strokeWidth={2.5} aria-label="failed" />}
              <span className="mt-px font-mono text-[11px] leading-5 text-muted tabular-nums" aria-hidden>{String(s.index).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex min-w-0 items-start gap-2">
                  <span className={cn("leading-snug", s.status === "running" ? "text-txt" : "text-txt/90")}>{s.name}</span>
                  {s.retried && s.status === "passed" && <FlakyChip />}
                  {s.retried && s.status !== "passed" && <span className="shrink-0 text-[11px] text-muted">retrying</span>}
                  {blank.has(s.name) && <UnverifiedChip reasons={["passes without the app"]} />}
                </span>
                {s.error && <span className="font-mono text-xs break-words whitespace-pre-wrap text-danger">{s.error}</span>}
              </span>
              <span className="mt-px font-mono text-[11px] leading-5 text-muted tabular-nums">
                {began[s.index] ? clock((ended[s.index] ?? now) - began[s.index]) : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      {run.state === "error" && (
        <div className="flex flex-col gap-1.5">
          {run.error && <p className="text-xs text-danger">{run.error}</p>}
          {run.tail && (
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-bg p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
              {run.tail.split("\n").slice(-20).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
