"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { clock, timeAgo } from "@/components/activity/ActivityEventRow"
import { MarkdownRenderer, flashElement } from "@/components/docs/MarkdownRenderer"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ReviewActions } from "@/components/board/TaskDetailPanel"
import { AlertTriangle, Check, HelpCircle, X } from "lucide-react"
import type { ReviewMark } from "@/lib/review"

type Row = { item: number; text: string; auto: boolean; result: "passed" | "failed" | "missing" | "manual"; screenshot: string | null; error: string | null; unverified: string[]; flaky?: { attempts: number; error: string | null; screenshot: string | null } | null }

/** R065: a step that passed only on a retry. Shown, never counted as broken. */
export function FlakyChip({ attempts }: { attempts?: number }) {
  return (
    <span title={attempts ? `Passed on attempt ${attempts} after a failure` : "Passed on a retry after a failure"} className="inline-flex shrink-0 items-center rounded-sm border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-[11px] leading-none text-amber">
      flaky
    </span>
  )
}

/** R063: a passed step that doesn't prove its item; the reasons ride in the title and under the step. */
export function UnverifiedChip({ reasons }: { reasons: string[] }) {
  return (
    <span title={`Unverified: ${reasons.join(", ")}`} className="inline-flex shrink-0 items-center rounded-sm border border-dashed border-amber/60 px-1.5 py-0.5 text-[11px] leading-none text-amber">
      unverified
    </span>
  )
}

/** `07:43`, or `Oct 4 07:43` when not today (local time) */
const stamp = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? clock(iso) : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${clock(iso)}`
}

// Classes set from enhance() below; literal here so Tailwind generates them (RunPlayer's step thumbnail)
const THUMB_BTN = "my-1 block w-fit cursor-zoom-in rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
const THUMB = "aspect-video w-18 rounded-sm border border-border bg-surface2 object-cover object-top"
const SHOT_BTN = "my-2 block w-fit max-w-full cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
const SHOT = "block max-h-[50svh] max-w-full rounded-md border border-danger/50"
const LOG_BTN = "-mt-2 mb-2 block rounded-sm text-xs text-accent-edge hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
/** Logs longer than this clamp, with a Show full log toggle (a short failed-step error stays whole) */
const LOG_LINES = 6

/**
 * The rendered doc made scannable: each screenshot becomes a button that opens it large (labelled with its step),
 * a passed step's as a thumbnail, a failed step's full width; long logs clamp. Idempotent (StrictMode, same html).
 */
function enhance(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img:not([data-shot])").forEach((img, i) => {
    const failed = !!img.closest("li")?.textContent?.trimStart().startsWith("❌")
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = failed ? SHOT_BTN : THUMB_BTN
    btn.dataset.zoom = img.getAttribute("src") ?? ""
    btn.dataset.alt = img.alt
    btn.setAttribute("aria-label", `Show the screenshot of ${img.alt}`)
    img.replaceWith(btn)
    img.dataset.shot = String(i)
    img.alt = ""
    img.loading = "lazy"
    img.className = failed ? SHOT : THUMB
    btn.append(img)
  })
  root.querySelectorAll<HTMLPreElement>("pre:not([id])").forEach((pre, i) => {
    pre.id = `evidence-log-${i}`
    const lines = (pre.textContent ?? "").trimEnd().split("\n").length
    if (lines <= LOG_LINES) return
    pre.dataset.clamped = ""
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = LOG_BTN
    btn.dataset.log = pre.id
    btn.dataset.lines = String(lines)
    btn.setAttribute("aria-controls", pre.id)
    btn.setAttribute("aria-expanded", "false")
    btn.textContent = `Show full log (${lines} lines)`
    pre.after(btn)
  })
}

type Run = { runId: string; status: "passed" | "failed"; startedAt: string; commit: string | null }
type Evidence = { markdown: string; runId: string | null; runs: Run[]; rows: Row[] }

/**
 * The evidence view on /manual-tests (R060): the task's evidence doc from `/api/tasks/<id>/evidence` (same formatter
 * as the fixture's EVIDENCE.md, with API links), above it the kept runs to pick from (`&run=`). Mount with key={taskId}.
 * `latest` = the board's newest run id, so a new run refetches. A screenshot click opens it large; media links open
 * in a new tab, except the newest run's video, which `onReplay` plays in the Review view. The doc's head (verdict, coverage, run line: everything before its first `## `) renders above History,
 * the rest below; `#heading` links in it scroll within the view.
 */
export function TestEvidence({ taskId, latest, run, onRun, onReplay, review }: {
  taskId: string
  latest: string | null
  run: string | null
  onRun: (runId: string | null) => void
  /** The newest run's video plays in the Review view */
  onReplay: () => void
  /** R062: the task waits in review → Approve / Send back on top of the proof (prefilled note, extra controls) */
  review?: { initialNote: string; onDecided: () => void; children?: ReactNode }
}) {
  const { rootParam } = useApp()
  // gone = the ?run= isn't kept (pruned or malformed); runs then lists the kept ones so History stays
  const [data, setData] = useState<{ key: string; evidence: Evidence | null; error: string | null; gone?: boolean; runs?: Run[] } | null>(null)
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const key = `${taskId}|${run}|${latest}|${rootParam}|${attempt}`

  useEffect(() => {
    let live = true
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/evidence${rootParam}${run ? `&run=${encodeURIComponent(run)}` : ""}`)
      .then(async (r) => {
        const json = await r.json().catch(() => null)
        if (live) setData({ key, evidence: r.ok ? json : null, error: r.ok ? null : json?.error ?? `Request failed (${r.status})`, gone: json?.gone, runs: json?.runs })
      })
      .catch((e) => { if (live) setData({ key, evidence: null, error: (e as Error).message }) })
    return () => { live = false }
  }, [key, taskId, run, rootParam])

  const loading = data?.key !== key
  const evidence = data?.evidence ?? null
  const cut = evidence ? evidence.markdown.search(/^## /m) : -1
  const newest = evidence?.runs[0]
  // The newest run, when an older one is shown
  const newer = newest && evidence!.runId !== newest.runId ? newest : null
  const shown = evidence?.runs.find((r) => r.runId === evidence.runId)
  // The newest run plays in Review's player; an older one only has its raw file
  const head = (evidence ? (cut < 0 ? evidence.markdown : evidence.markdown.slice(0, cut)) : "")
    .replace("[▶ Video of this run](", newer ? "[Open video (.webm) ↗](" : "[▶ Play this run in Review](")
    // The doc keeps UTC (EVIDENCE.md / MCP); here the run line matches History's local time
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/, (t) => (shown ? stamp(shown.startedAt) : t))
  // The doc's own `## History` table (always last) is for EVIDENCE.md / MCP; here the History nav above replaces it
  const body = evidence && cut >= 0 ? evidence.markdown.slice(cut).replace(/^## History\n[\s\S]*$/m, "") : ""
  const runs = evidence?.runs ?? (loading ? [] : data?.runs ?? [])
  const error = loading ? null : data?.error ?? null


  // Before paint, so an 11k px doc never flashes full-size screenshots and logs
  useLayoutEffect(() => { if (root.current) enhance(root.current) }, [head, body])

  const older = !!newer

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
      <div
        ref={root}
        className={cn(
          "flex min-w-0 flex-col gap-4 transition-opacity duration-(--duration-fast) [&_h1]:hidden [&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4 [&_strong>a]:text-danger! [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
          loading && evidence && "opacity-60",
        )}
        onClick={(e) => {
          const el = e.target as HTMLElement
          const shot = el.closest<HTMLElement>("[data-zoom]")
          if (shot) return setZoom({ src: shot.dataset.zoom!, alt: shot.dataset.alt ?? "" })
          const log = el.closest<HTMLElement>("[data-log]")
          if (log) {
            const pre = document.getElementById(log.dataset.log!)
            const open = log.getAttribute("aria-expanded") !== "true"
            pre?.toggleAttribute("data-clamped", !open)
            log.setAttribute("aria-expanded", String(open))
            log.textContent = open ? "Show less" : `Show full log (${log.dataset.lines} lines)`
            return
          }
          const a = el.closest("a")
          const href = a?.getAttribute("href") ?? ""
          if (href.startsWith("#")) {
            // In-doc jump (verdict → the failure's group): scroll here, never write a hash onto this URL
            e.preventDefault()
            const target = e.currentTarget.querySelector<HTMLElement>(`[id="${CSS.escape(href.slice(1))}"]`)
            if (!target) return
            const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            target.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" })
            const row = target.nextElementSibling?.querySelector("li")
            if (row instanceof HTMLElement) flashElement(row)
          } else if (!newer && /\.webm(?:\?|$)/.test(href) && !e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            onReplay()
          } else if (href.startsWith("/api/") && !e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            window.open(a!.href, "_blank", "noopener,noreferrer")
          }
        }}
      >
        {/* Announces a run pick (History, [ ], Show newest): the region stays, its text changes */}
        <p className="sr-only" aria-live="polite" aria-atomic>
          {!loading && shown ? `Showing ${shown === newest ? "the newest run" : "run"} from ${stamp(shown.startedAt)}, ${shown.status}` : ""}
        </p>

        {evidence && <MarkdownRenderer content={head} className="prose-evidence" />}

        {error && (
          <div role="alert" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            {data?.gone ? (
              <>
                <span className="text-txt">That run isn&apos;t kept any more.</span>
                <button type="button" onClick={() => onRun(null)} className="rounded-sm text-accent-edge hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Show newest run →</button>
              </>
            ) : (
              <>
                <span className="text-danger">Couldn&apos;t load the evidence.</span>
                <span className="text-xs text-muted">{error}</span>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-sm text-accent-edge hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Retry</button>
              </>
            )}
          </div>
        )}

        {newer && (
          <p className="-mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
            <span className="text-txt">Older run</span>
            <span aria-hidden>·</span>
            <span>newest <span className={newer.status === "passed" ? "text-teal" : "text-danger"}>{newer.status}</span> <span className="font-mono text-[11px] tabular-nums" title={newer.startedAt}>{timeAgo(newer.startedAt)}</span></span>
            <button type="button" onClick={() => onRun(null)} className="rounded-sm text-accent-edge hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Show newest →</button>
          </p>
        )}

        {runs.length > 0 && (
          <nav aria-labelledby="evidence-history" className="flex flex-col gap-1">
            {/* h2: the doc's H1 is hidden and its sections are h2, so History sits at the same level */}
            <h2 id="evidence-history" className="text-[13px] font-medium text-txt">History <span className="font-mono text-[11px] font-normal text-muted tabular-nums">{runs.length}</span></h2>
            <ol className="-mx-2 flex flex-col">
              {runs.map((r, i) => {
                const current = r.runId === evidence?.runId
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
                      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted tabular-nums" title={r.startedAt}>{timeAgo(r.startedAt)}</span>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted tabular-nums max-sm:hidden">{stamp(r.startedAt)}</span>
                      {r.commit && <code className="font-mono text-[11px] text-muted">{r.commit.slice(0, 7)}</code>}
                      {i === 0 && <span className="shrink-0 whitespace-nowrap text-muted">· newest</span>}
                      {current && <span className="ml-auto text-[11px] text-txt">shown</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        {loading && !evidence ? (
          <div role="status" aria-busy aria-label="Loading evidence" className="flex flex-col gap-2">
            <div className="h-5 w-2/3 animate-pulse rounded-sm bg-surface2" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface2" />
            <div className="aspect-video w-full animate-pulse rounded-md bg-surface2" />
          </div>
        ) : body && <MarkdownRenderer content={body} className="prose-evidence" />}
      </div>

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
  // R063: passed but not proven: flagged like failed steps, not something the reviewer can clear
  const unverified = rows.filter((r) => r.result === "passed" && r.unverified.length)
  const doubted = rows.filter((r) => r.item in doubts)
  const marks: ReviewMark[] = [
    ...failed.map((r) => ({ item: r.item, step: r.text, kind: "failed" as const, ...(r.error ? { comment: r.error.split("\n")[0] } : {}), ...(r.screenshot ? { screenshot: r.screenshot } : {}) })),
    ...unverified.map((r) => ({ item: r.item, step: r.text, kind: "unverified" as const, comment: r.unverified.join(", "), ...(r.screenshot ? { screenshot: r.screenshot } : {}) })),
    ...doubted.map((r) => ({ item: r.item, step: r.text, kind: "doubt" as const, ...(doubts[r.item].trim() ? { comment: doubts[r.item] } : {}), ...(r.screenshot ? { screenshot: r.screenshot } : {}) })),
  ].sort((a, b) => a.item - b.item)
  const count = [doubted.length && `${doubted.length} flagged`, failed.length && `${failed.length} failed`, unverified.length && `${unverified.length} unverified`].filter(Boolean).join(" · ")

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
                {m.kind === "failed" ? <X className="mt-0.5 size-3.5 shrink-0 text-danger" aria-label="failed" />
                  : m.kind === "unverified" ? <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="unverified" />
                  : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="doubt" />}
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
            const weak = r.result === "passed" && r.unverified.length > 0
            return (
              <li key={r.item} className={cn("flex flex-col gap-1.5 border-l-2 py-1.5 pl-2.5", r.result === "failed" ? "border-danger" : doubt ? "border-amber" : weak ? "border-dashed border-amber/60" : "border-transparent")}>
                <div className="flex items-start gap-2">
                  {r.result === "failed" ? <X className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2.5} aria-label="failed" />
                    : doubt ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-label="doubted" />
                    : weak ? <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber" aria-label="unverified" />
                    : r.result === "passed" ? <Check className="mt-0.5 size-4 shrink-0 text-teal" strokeWidth={2.5} aria-label="passed" />
                    : <span className="mt-0.5 size-4 shrink-0 text-center text-xs text-muted" aria-label="no step in this run">–</span>}
                  {r.screenshot && (
                    <button type="button" onClick={() => onZoom({ src: media(r.screenshot!), alt: r.text })} className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Screenshot of step ${r.item + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API */}
                      <img src={media(r.screenshot)} alt="" loading="lazy" className="h-10 w-16 rounded-sm border border-border object-cover object-top" />
                    </button>
                  )}
                  <span className="min-w-0 flex-1 text-sm leading-snug text-txt">{r.text}</span>
                  {r.flaky && <FlakyChip attempts={r.flaky.attempts} />}
                  {weak && <UnverifiedChip reasons={r.unverified} />}
                  {r.result === "passed" && !weak && (
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
                {r.flaky && (
                  <details className="ml-6 text-xs">
                    <summary className="cursor-pointer text-amber">First attempt failed (passed on attempt {r.flaky.attempts})</summary>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {r.flaky.error && <span className="font-mono whitespace-pre-wrap text-danger">{r.flaky.error.split("\n").filter(Boolean).slice(0, 4).join("\n")}</span>}
                      {r.flaky.screenshot && (
                        <button type="button" onClick={() => onZoom({ src: media(r.flaky!.screenshot!), alt: `${r.text} (first attempt)` })} className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-accent" aria-label={`First attempt screenshot of step ${r.item + 1}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API */}
                          <img src={media(r.flaky.screenshot)} alt="" loading="lazy" className="h-16 w-28 rounded-sm border border-border object-cover object-top" />
                        </button>
                      )}
                    </div>
                  </details>
                )}
                {weak && <span className="ml-6 text-xs text-amber">Unverified: {r.unverified.join(", ")}. It passed but proves nothing about the app; check it by hand.</span>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

