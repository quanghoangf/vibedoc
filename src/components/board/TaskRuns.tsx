"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ImageOff, Loader2, Play, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { RunManifest, RunStep } from "@/lib/runs-paths"
import { useTestRun } from "@/components/manual-tests/useTestRun"
import { useSuiteRun } from "@/components/manual-tests/useSuiteRun"
import { isRunning } from "@/lib/test-run-events"
import { testReviewHref } from "@/lib/test-review"

/**
 * A task's recorded test runs (R059): the picked run's step screenshots + video, newest run first.
 * Mount with key={taskId}. `latest` = the board's newest run id, so a new run refetches. The evidence doc with every
 * kept run (R060) is one click away on /manual-tests; `onNavigate` closes the panel first.
 */
export function TaskRuns({ taskId, latest, spec, onNavigate }: { taskId: string; latest: string | null; spec?: string | null; onNavigate?: () => void }) {
  const { rootParam, demo, playground } = useApp()
  const f = useFormat()
  const { t } = useT()
  // R061: Run / Stop this task's spec; while it runs, one live line replaces the picked run
  const testRun = useTestRun()
  const live = testRun.run?.taskId === taskId && isRunning(testRun.run) ? testRun.run : null
  const suiteRun = useSuiteRun()
  const otherRun = suiteRun.busy ? t("board.theSuite") : testRun.busy && !live ? testRun.run!.taskId : null
  const current = live?.steps.at(-1)
  const [runs, setRuns] = useState<RunManifest[] | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState<RunStep | null>(null)

  useEffect(() => {
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/runs${rootParam}`)
      .then(r => r.json())
      .then(data => setRuns(Array.isArray(data?.runs) ? data.runs : []))
      .catch(() => setRuns([]))
  }, [rootParam, taskId, latest])

  // Radix lets the task sheet take this Escape too (it closed the whole panel), so the viewer claims it first:
  // window capture runs before Radix's document listener.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(null)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  const run = runs?.find(r => r.runId === picked) ?? runs?.[0] ?? null
  const media = (file: string) => `/api/tasks/${encodeURIComponent(taskId)}/runs/${run?.runId}/${encodeURIComponent(file)}${rootParam}`
  const passed = run?.steps.filter(s => s.status === "passed").length ?? 0

  return (
    <section aria-label={t("board.testRuns")} className="px-5 py-3 border-b border-border shrink-0">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-mono uppercase tracking-wide text-muted">{t("board.runs")}</p>
        {spec && !demo && !playground && (
          <button
            type="button"
            onClick={() => void (live ? testRun.stop() : testRun.start(taskId))}
            disabled={!!otherRun}
            title={otherRun ? t("board.isRunning", { name: otherRun }) : live ? t("board.stopRun") : t("board.runSpec", { spec })}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40",
              live ? "border-danger/40 text-danger hover:bg-danger/10" : "border-border text-txt hover:border-accent/50",
            )}
          >
            {live ? <><Square className="size-3" aria-hidden /> {t("board.stop")}</> : <><Play className="size-3" aria-hidden /> {t("board.run")}</>}
          </button>
        )}
        <Link
          href={testReviewHref(taskId, "evidence")}
          onClick={onNavigate}
          className="ml-auto rounded-sm text-xs text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t("board.evidenceLink")}
        </Link>
      </div>
      {live ? (
        <p aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-xs text-txt">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" aria-hidden />
          {current
            ? <><span className="shrink-0 font-mono text-muted">{t("board.stepN", { n: current.index })}</span><span className="truncate" title={current.name}>{current.name}</span></>
            : <span className="text-muted">{t("board.startingApp")}</span>}
        </p>
      ) : runs === null ? null : !run ? (
        <p className="text-xs text-muted">
          {t("board.noRunsLead")}<code className="font-mono text-txt">vibedoc_get_frontend</code> {t("board.noRunsMiddle")} <code className="font-mono text-txt">step()</code> {t("board.noRunsEnd")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={cn("rounded-sm px-1.5 py-0.5 font-mono", run.status === "passed" ? "bg-teal/15 text-teal" : "bg-danger/15 text-danger")}>{run.status === "passed" ? t("board.runPassed") : t("board.runFailed")}</span>
            <span className="font-mono text-muted" title={run.endedAt}>{f.timeAgo(run.endedAt || run.startedAt)}</span>
            <span className="text-muted"><span className="font-mono text-txt">{passed}/{run.steps.length}</span> {t("board.stepsPassed")}</span>
            <select
              aria-label={t("board.pickRun")}
              value={run.runId}
              onChange={e => setPicked(e.target.value)}
              className="ml-auto max-w-full rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              {runs.map(r => (
                <option key={r.runId} value={r.runId}>{f.dateTime(r.startedAt)} · {r.status === "passed" ? t("board.runPassed") : t("board.runFailed")}</option>
              ))}
            </select>
          </div>

          {run.steps.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {run.steps.map(s => (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => setOpen(s)}
                    title={s.error ? `${s.name}\n${s.error}` : s.name}
                    className="group flex w-full flex-col overflow-hidden rounded-sm border border-border text-left hover:border-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {s.screenshot ? (
                      // eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API, not a static asset
                      <img src={media(s.screenshot)} alt={s.name} loading="lazy" className="aspect-video w-full bg-surface2 object-cover object-top" />
                    ) : (
                      <span className="flex aspect-video w-full items-center justify-center bg-surface2 text-muted"><ImageOff className="size-4" aria-label={t("board.noScreenshot")} /></span>
                    )}
                    <span className="flex items-start gap-1 px-1.5 py-1 text-[11px] leading-tight">
                      {s.status === "passed"
                        ? <Check className="mt-px size-3 shrink-0 text-teal" aria-label={t("board.runPassed")} />
                        : <X className="mt-px size-3 shrink-0 text-danger" aria-label={t("board.runFailed")} />}
                      <span className="line-clamp-2 text-txt">{s.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {run.video && (
            <video key={run.runId} controls preload="metadata" src={media(run.video)} className="w-full rounded-sm border border-border bg-black" />
          )}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={o => { if (!o) setOpen(null) }}>
        <DialogContent className="max-h-[90vh] max-w-[min(64rem,calc(100vw-2rem))] overflow-y-auto">
          {open && (
            <>
              <DialogTitle className="flex items-center gap-1.5 pr-6 text-sm">
                {open.status === "passed" ? <Check className="size-4 shrink-0 text-teal" aria-hidden /> : <X className="size-4 shrink-0 text-danger" aria-hidden />}
                {open.name}
              </DialogTitle>
              <DialogDescription className={cn("text-xs", open.error ? "whitespace-pre-wrap font-mono text-danger" : "sr-only")}>
                {open.error ?? t("board.stepPassed", { n: open.index })}
              </DialogDescription>
              {open.screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API, not a static asset
                <img src={media(open.screenshot)} alt={open.name} className="w-full rounded-sm border border-border" />
              ) : (
                <p className="text-xs text-muted">{t("board.noScreenshotSaved")}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
