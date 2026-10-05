"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ReviewActions } from "@/components/board/TaskDetailPanel"
import { AlertTriangle, Check, X } from "lucide-react"
import type { ReviewMark } from "@/lib/review"

type Row = { item: number; text: string; auto: boolean; result: "passed" | "failed" | "missing" | "manual"; screenshot: string | null; error: string | null }
type Evidence = { markdown: string; runId: string | null; runs: { runId: string; status: "passed" | "failed"; startedAt: string; commit: string | null }[]; rows: Row[] }

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
        <ReviewDesk
          key={`${taskId}:${evidence?.runId ?? "none"}`}
          taskId={taskId}
          runId={evidence?.runId ?? null}
          rows={evidence?.rows.filter((r) => r.auto) ?? []}
          initialNote={review.initialNote}
          onDecided={review.onDecided}
          onZoom={setZoom}
          head={
            <p className="text-xs text-muted">
              {shown
                ? <>Reviewing the {older ? "older" : "newest"} run · <span className={shown.status === "passed" ? "text-teal" : "text-danger"}>{shown.status}</span> · <span className="font-mono" title={shown.startedAt}>{timeAgo(shown.startedAt)}</span>{shown.commit && <> · <code className="font-mono">{shown.commit.slice(0, 7)}</code></>}</>
                : loading ? "Loading the evidence…" : "No recorded run: decide from the checklist."}
            </p>
          }
          older={older}
        >
          {review.children}
        </ReviewDesk>
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

/**
 * R062: the review on top of the proof. Every automated step of the shown run with its result and thumbnail; a
 * Doubt toggle (+ one-line comment) on the ones that passed; failed steps are always flagged. The marks live here
 * only until Approve / Send back (keyed on task:run, so another run or task starts clean).
 */
function ReviewDesk({ taskId, runId, rows, initialNote, onDecided, onZoom, head, older, children }: {
  taskId: string
  runId: string | null
  rows: Row[]
  initialNote: string
  onDecided: () => void
  onZoom: (z: { src: string; alt: string }) => void
  head: ReactNode
  older: boolean
  children?: ReactNode
}) {
  const { rootParam } = useApp()
  const [doubts, setDoubts] = useState<Record<number, string>>({})
  const media = (file: string) => `/api/tasks/${encodeURIComponent(taskId)}/runs/${runId}/${encodeURIComponent(file)}${rootParam}`
  const failed = rows.filter((r) => r.result === "failed")
  const doubted = rows.filter((r) => r.item in doubts)
  const marks: ReviewMark[] = [
    ...failed.map((r) => ({ item: r.item, step: r.text, kind: "failed" as const, ...(r.error ? { comment: r.error.split("\n")[0] } : {}), ...(r.screenshot ? { screenshot: r.screenshot } : {}) })),
    ...doubted.map((r) => ({ item: r.item, step: r.text, kind: "doubt" as const, ...(doubts[r.item].trim() ? { comment: doubts[r.item] } : {}), ...(r.screenshot ? { screenshot: r.screenshot } : {}) })),
  ].sort((a, b) => a.item - b.item)
  const count = [doubted.length && `${doubted.length} flagged`, failed.length && `${failed.length} failed`].filter(Boolean).join(" · ")

  return (
    <div className="-mx-5 -mt-5 flex flex-col border-b border-border sm:-mx-7">
      <ReviewActions
        taskId={taskId}
        onDone={onDecided}
        runId={runId}
        marks={marks}
        initialNote={failed.length ? "" : initialNote}
        confirmApprove={doubted.length ? `Approve with ${doubted.length} ${doubted.length === 1 ? "doubt" : "doubts"}?` : null}
        className="rounded-none border-b-0 px-5 py-3 sm:px-7"
        marksList={marks.length > 0 && (
          <ul aria-label="Flagged steps" className="flex flex-col gap-1.5 rounded-md border border-border bg-bg p-2">
            {marks.map((m) => (
              <li key={m.item} className="flex items-start gap-2 text-xs">
                {m.kind === "failed" ? <X className="mt-0.5 size-3.5 shrink-0 text-danger" aria-label="failed" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="doubt" />}
                {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API */}
                {m.screenshot && <img src={media(m.screenshot)} alt="" className="h-9 w-14 shrink-0 rounded-sm border border-border object-cover object-top" />}
                <span className="min-w-0"><span className="font-mono text-muted">Step {m.item + 1}</span> <span className="text-txt">{m.step}</span>{m.comment && <span className="block text-muted">{m.comment}</span>}</span>
              </li>
            ))}
          </ul>
        )}
        prompt={
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium text-txt">
              Waiting for your review
              {count && <span className="text-xs font-normal text-amber">{count}</span>}
            </p>
            {head}
            {older && <p role="note" className="text-xs text-amber">You&apos;re looking at an older run. The newest one is first in History.</p>}
          </div>
        }
      >
        {children}
      </ReviewActions>

      {runId && rows.length > 0 && (
        <ol aria-label="Steps to review" className="flex flex-col px-5 pb-3 sm:px-7">
          {rows.map((r) => {
            const doubt = r.item in doubts
            return (
              <li key={r.item} className={cn("flex flex-col gap-1.5 border-l-2 py-1.5 pl-2.5", r.result === "failed" ? "border-danger" : doubt ? "border-amber" : "border-transparent")}>
                <div className="flex items-start gap-2">
                  {r.result === "failed" ? <X className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2.5} aria-label="failed" />
                    : doubt ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-label="doubted" />
                    : r.result === "passed" ? <Check className="mt-0.5 size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="passed" />
                    : <span className="mt-0.5 size-4 shrink-0 text-center text-xs text-muted" aria-label="no step in this run">–</span>}
                  {r.screenshot && (
                    <button type="button" onClick={() => onZoom({ src: media(r.screenshot!), alt: r.text })} className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Screenshot of step ${r.item + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API */}
                      <img src={media(r.screenshot)} alt="" loading="lazy" className="h-10 w-16 rounded-sm border border-border object-cover object-top" />
                    </button>
                  )}
                  <span className="min-w-0 flex-1 text-sm leading-snug text-txt">{r.text}</span>
                  {r.result === "passed" && (
                    <button
                      type="button"
                      aria-pressed={doubt}
                      onClick={() => setDoubts(({ [r.item]: _, ...rest }) => (doubt ? rest : { ...rest, [r.item]: "" }))}
                      title="Not convinced this step proves the item"
                      className={cn(
                        "shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                        doubt ? "border-amber/50 bg-amber/15 text-amber" : "border-border text-muted hover:border-amber/50 hover:text-amber",
                      )}
                    >
                      Doubt
                    </button>
                  )}
                </div>
                {doubt && (
                  <input
                    autoFocus
                    value={doubts[r.item]}
                    onChange={(e) => setDoubts((d) => ({ ...d, [r.item]: e.target.value }))}
                    placeholder="What looks wrong? (optional)"
                    aria-label={`Doubt comment for step ${r.item + 1}`}
                    className="ml-6 rounded-md border border-border bg-bg px-2 py-1 text-xs text-txt placeholder:text-muted focus:border-amber/60 focus:outline-hidden"
                  />
                )}
                {r.result === "failed" && r.error && <span className="ml-6 font-mono text-xs whitespace-pre-wrap text-danger">{r.error}</span>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

