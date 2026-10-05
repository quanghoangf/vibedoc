"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ReviewActions } from "@/components/board/TaskDetailPanel"

type Evidence = { markdown: string; runId: string | null; runs: { runId: string; status: "passed" | "failed"; startedAt: string; commit: string | null }[] }

/**
 * The evidence view on /manual-tests (R060): the task's evidence doc from `/api/tasks/<id>/evidence` (same formatter
 * as the fixture's EVIDENCE.md, with API links), above it the kept runs to pick from (`&run=`). Mount with key={taskId}.
 * `latest` = the board's newest run id, so a new run refetches. A screenshot click opens it large; media links open
 * in a new tab.
 */
export function TestEvidence({ taskId, latest, run, onRun, review }: {
  taskId: string
  latest: string | null
  run: string | null
  onRun: (runId: string | null) => void
  /** R062: the task waits in review → Approve / Send back on top of the proof (prefilled note, extra controls) */
  review?: { initialNote: string; onDecided: () => void; children?: ReactNode }
}) {
  const { rootParam } = useApp()
  const [data, setData] = useState<{ key: string; evidence: Evidence | null; error: string | null } | null>(null)
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
  const key = `${taskId}|${run}|${latest}|${rootParam}`

  useEffect(() => {
    let live = true
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/evidence${rootParam}${run ? `&run=${encodeURIComponent(run)}` : ""}`)
      .then(async (r) => {
        const json = await r.json().catch(() => null)
        if (live) setData({ key, evidence: r.ok ? json : null, error: r.ok ? null : json?.error ?? `Request failed (${r.status})` })
      })
      .catch((e) => { if (live) setData({ key, evidence: null, error: (e as Error).message }) })
    return () => { live = false }
  }, [key, taskId, run, rootParam])

  const loading = data?.key !== key
  const evidence = data?.evidence ?? null

  const shown = evidence?.runs.find((r) => r.runId === evidence.runId) ?? null
  const older = !!shown && evidence?.runs[0]?.runId !== shown.runId

  return (
    <div className="flex flex-col gap-4">
      {review && (
        <ReviewActions
          key={taskId}
          taskId={taskId}
          onDone={review.onDecided}
          initialNote={review.initialNote}
          className="-mx-5 -mt-5 rounded-none border-b border-border px-5 py-3 sm:-mx-7 sm:px-7"
          prompt={
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13px] font-medium text-txt">Waiting for your review</p>
              <p className="text-xs text-muted">
                {shown
                  ? <>Reviewing the {older ? "older" : "newest"} run · <span className={shown.status === "passed" ? "text-teal" : "text-danger"}>{shown.status}</span> · <span className="font-mono" title={shown.startedAt}>{timeAgo(shown.startedAt)}</span>{shown.commit && <> · <code className="font-mono">{shown.commit.slice(0, 7)}</code></>}</>
                  : loading ? "Loading the evidence…" : "No recorded run: decide from the checklist."}
              </p>
              {older && <p role="note" className="text-xs text-amber">You&apos;re looking at an older run. The newest one is first in History.</p>}
            </div>
          }
        >
          {review.children}
        </ReviewActions>
      )}
      {(evidence?.runs.length ?? 0) > 1 && (
        <nav aria-label="Runs" className="flex flex-col gap-1">
          <h3 className="text-[13px] font-medium text-txt">History <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{evidence!.runs.length}</span></h3>
          <ol className="-mx-2 flex flex-col">
            {evidence!.runs.map((r, i) => {
              const current = r.runId === evidence!.runId
              return (
                <li key={r.runId}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    onClick={() => onRun(i === 0 ? null : r.runId)}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent",
                      current && "bg-surface2",
                    )}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", r.status === "passed" ? "bg-teal" : "bg-danger")} aria-hidden />
                    <span className={cn("w-12 shrink-0", r.status === "passed" ? "text-teal" : "text-danger")}>{r.status}</span>
                    <span className="font-mono text-muted tabular-nums" title={r.startedAt}>{timeAgo(r.startedAt)}</span>
                    {r.commit && <code className="font-mono text-[11px] text-muted">{r.commit.slice(0, 7)}</code>}
                    {i === 0 && <span className="text-muted">· newest</span>}
                    {current && <span className="ml-auto text-[11px] text-txt">shown</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {loading && !evidence ? (
        <div aria-busy className="flex flex-col gap-2" aria-label="Loading evidence">
          <div className="h-5 w-2/3 animate-pulse rounded-sm bg-surface2" />
          <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface2" />
          <div className="aspect-video w-full animate-pulse rounded-md bg-surface2" />
        </div>
      ) : data?.error ? (
        <p role="alert" className="text-sm text-danger">{data.error}</p>
      ) : evidence && (
        <div
          className={cn(
            "min-w-0 transition-opacity duration-(--duration-fast) [&_h1]:hidden [&_ul]:list-none [&_ul]:pl-0 [&_li]:list-none [&_img]:my-2 [&_img]:block [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
            loading && "opacity-60",
          )}
          onClick={(e) => {
            const el = e.target as HTMLElement
            if (el instanceof HTMLImageElement) return setZoom({ src: el.src, alt: el.alt })
            const a = el.closest("a")
            if (a?.getAttribute("href")?.startsWith("/api/") && !e.metaKey && !e.ctrlKey) {
              e.preventDefault()
              window.open(a.href, "_blank", "noopener,noreferrer")
            }
          }}
        >
          <MarkdownRenderer content={evidence.markdown} />
        </div>
      )}

      <Dialog open={zoom !== null} onOpenChange={(o) => { if (!o) setZoom(null) }}>
        <DialogContent className="max-h-[90vh] max-w-[min(64rem,calc(100vw-2rem))] overflow-y-auto">
          <DialogTitle className="pr-6 text-sm">{zoom?.alt}</DialogTitle>
          <DialogDescription className="sr-only">Screenshot</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API, not a static asset */}
          {zoom && <img src={zoom.src} alt={zoom.alt} className="w-full rounded-sm border border-border" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
