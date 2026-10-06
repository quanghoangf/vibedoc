"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Check, Film, ImageOff, Pause, Play, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useFormat } from "@/context/LanguageContext"
import { runClock, stepAt, stepSpans } from "@/lib/test-review"
import type { RunManifest, RunStep } from "@/lib/runs-paths"

/**
 * A task's recorded runs as a replay: the video (or a step's screenshot) on a sticky stage, our own timeline
 * (play/pause, a step track that is the only scrubber, elapsed/total) and the step list. Steps carry
 * `startMs`/`endMs` since R059's capture fixture records them; older runs have none, so their steps open the
 * screenshot instead of seeking. A failed run opens paused on the failed step's screenshot frame.
 * Keys while the player has focus: ←/→ previous/next step, space play/pause. Mount with key={taskId}.
 */
export function RunPlayer({ taskId, latest }: { taskId: string; latest: string | null }) {
  const { rootParam } = useApp()
  const f = useFormat()
  const [runs, setRuns] = useState<RunManifest[] | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  // null = the video; a step = its screenshot on the stage
  const [still, setStill] = useState<RunStep | null>(null)
  const [now, setNow] = useState(0)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(true)
  const video = useRef<HTMLVideoElement>(null)
  const head = useRef<HTMLSpanElement>(null)
  // A webm from Playwright reports duration Infinity until we seek past its end once
  const probing = useRef(false)

  useEffect(() => {
    let live = true
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/runs${rootParam}`)
      .then((r) => r.json())
      .then((data) => { if (live) setRuns(Array.isArray(data?.runs) ? data.runs : []) })
      .catch(() => { if (live) setRuns([]) })
    return () => { live = false }
  }, [rootParam, taskId, latest])

  const run = runs?.find((r) => r.runId === picked) ?? runs?.[0] ?? null
  const media = (file: string) => `/api/tasks/${encodeURIComponent(taskId)}/runs/${run?.runId}/${encodeURIComponent(file)}${rootParam}`
  const timed = !!run?.video && run.steps.length > 0 && run.steps.every((s) => typeof s.startMs === "number" && typeof s.endMs === "number")
  const spans = timed ? stepSpans(run.steps, duration * 1000) : []
  // Until the video's length is known, the last step's end stands in for it
  const totalMs = duration > 0 ? duration * 1000 : Math.max(1, ...(run?.steps.map((s) => s.endMs ?? 0) ?? []))
  const current = still?.index ?? (timed ? stepAt(spans, now) : null)
  const failed = run?.steps.find((s) => s.status === "failed") ?? null
  const failedSpan = spans.find((sp) => sp.index === failed?.index) ?? null
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / totalMs) * 100))}%`
  const time = (ms: number) => runClock(ms, totalMs)

  // While playing, move the playhead every frame; React state follows at timeupdate's ~4Hz
  useEffect(() => {
    if (paused) return
    let raf = 0
    const tick = () => {
      const v = video.current
      if (v && head.current) head.current.style.left = pct(v.currentTime * 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  function pickRun(id: string) {
    setPicked(id)
    setStill(null)
    setNow(0)
    setDuration(0)
    setPaused(true)
  }

  /** Length known: a failed run opens paused on the failed step's screenshot frame, the rest at 0:00. */
  function ready(v: HTMLVideoElement) {
    const d = v.duration
    setDuration(d)
    const at = run?.status === "failed" && timed && failed ? stepSpans(run.steps, d * 1000).find((sp) => sp.index === failed.index)?.at ?? 0 : 0
    v.currentTime = at / 1000
    setNow(at)
  }

  function seek(ms: number) {
    const v = video.current
    if (!v) return
    v.pause()
    setStill(null)
    const t = Math.min(Math.max(0, ms), totalMs)
    v.currentTime = t / 1000
    setNow(t)
    if (head.current) head.current.style.left = pct(t)
  }

  /** A step: seek to the moment its screenshot was taken, or show the screenshot when the run has no timing. */
  function goTo(s: RunStep) {
    const sp = spans.find((x) => x.index === s.index)
    if (sp && video.current) seek(sp.at)
    else setStill(s)
  }

  function stepBy(dir: 1 | -1) {
    const steps = run?.steps ?? []
    if (!steps.length) return
    let target: RunStep | undefined
    if (still || !timed) {
      const i = still ? steps.findIndex((s) => s.index === still.index) : dir > 0 ? -1 : steps.length
      target = steps[i + dir]
    } else {
      const sp = dir > 0 ? spans.find((x) => x.at > now + 1) : spans.findLast((x) => x.at < now - 1)
      target = steps.find((s) => s.index === sp?.index)
    }
    if (target) goTo(target)
  }

  function toggle() {
    const v = video.current
    if (!v) return
    setStill(null)
    if (!v.paused) return v.pause()
    if (v.ended || v.currentTime * 1000 >= totalMs - 1) v.currentTime = 0
    void v.play()
  }

  function onPlayerKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLSelectElement || e.altKey || e.metaKey || e.ctrlKey) return
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") stepBy(e.key === "ArrowRight" ? 1 : -1)
    else if (e.key === " " && run?.video && !(e.target instanceof HTMLButtonElement)) toggle()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  function onTrackKey(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0
    if (dir && timed) stepBy(dir)
    else if (dir) seek(now + dir * Math.max(100, totalMs / 20))
    else if (e.key === "Home") seek(0)
    else if (e.key === "End") seek(totalMs)
    else if (e.key === " ") toggle()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  function scrub(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    seek(((e.clientX - r.left) / r.width) * totalMs)
  }

  if (runs === null) return <div className="aspect-video w-full animate-pulse rounded-md bg-surface2" aria-label="Loading runs" />

  if (!run) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border2 px-5 py-6">
        <Film className="size-5 text-muted" aria-hidden />
        <p className="text-sm text-txt">No recorded run yet</p>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          A spec that imports <code className="font-mono text-txt">vibedoc/playwright</code> and wraps each checklist item in{" "}
          <code className="font-mono text-txt">step()</code> records a video and a screenshot per step here.
        </p>
      </div>
    )
  }

  const passed = run.steps.filter((s) => s.status === "passed").length
  const currentStep = run.steps.find((s) => s.index === current)

  return (
    // tabIndex -1: a click anywhere in the player focuses it, so ←/→ and space reach onPlayerKey
    <div className="flex flex-col gap-3 outline-none" tabIndex={-1} onKeyDown={onPlayerKey}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-xs font-medium",
          run.status === "passed" ? "bg-teal/15 text-teal" : "bg-danger/15 text-danger",
        )}>
          {run.status === "passed" ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {run.status}
        </span>
        <span className="text-xs text-muted">
          <span className="font-mono text-txt tabular-nums">{passed}/{run.steps.length}</span> steps ·{" "}
          <span className="font-mono" title={run.endedAt}>{f.timeAgo(run.endedAt || run.startedAt)}</span>
          {run.commit && <> · <span className="font-mono" title={run.commit}>{run.commit.slice(0, 7)}</span></>}
        </span>
        {runs.length > 1 && (
          <select
            aria-label="Run"
            value={run.runId}
            onChange={(e) => pickRun(e.target.value)}
            className="ml-auto max-w-full rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs text-txt hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {runs.map((r, i) => (
              <option key={r.runId} value={r.runId} title={r.startedAt}>{i === 0 ? "Latest · " : ""}{f.timeAgo(r.startedAt)} · {f.clock(r.startedAt)} · {r.status}</option>
            ))}
          </select>
        )}
      </div>

      {/* Sticky, so a step clicked lower in the list always shows its result */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-col gap-2 bg-bg px-2 pt-2 pb-1">
        {/* Stage: the video, or the screenshot of a step picked from a run without timing */}
        <div className="relative overflow-hidden rounded-md border border-border bg-black">
          {run.video && (
            <video
              key={run.runId}
              ref={video}
              preload="auto"
              playsInline
              src={media(run.video)}
              aria-label={`Recording of the ${run.status} run, ${run.steps.length} steps`}
              onClick={toggle}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                if (Number.isFinite(v.duration)) return ready(v)
                probing.current = true
                v.currentTime = 1e9
              }}
              onDurationChange={(e) => {
                if (!probing.current || !Number.isFinite(e.currentTarget.duration)) return
                probing.current = false
                ready(e.currentTarget)
              }}
              onTimeUpdate={(e) => { if (!probing.current) setNow(e.currentTarget.currentTime * 1000) }}
              onPlay={() => { setStill(null); setPaused(false) }}
              onPause={() => setPaused(true)}
              className={cn("block aspect-video max-h-[38svh] w-full [@media(max-height:760px)]:max-h-[26svh] cursor-pointer bg-black object-contain", still && "invisible")}
            />
          )}
          {(still || !run.video) && (
            <div className={cn("flex aspect-video max-h-[38svh] w-full [@media(max-height:760px)]:max-h-[26svh] items-center justify-center bg-surface2", run.video && "absolute inset-0 max-h-none")}>
              {still?.screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API, not a static asset
                <img src={media(still.screenshot)} alt={`Step ${still.index}: ${still.name}`} className="size-full object-contain object-top" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-xs text-muted">
                  <ImageOff className="size-5" aria-hidden />
                  {still ? "No screenshot was saved for this step" : "This run has no video"}
                </span>
              )}
            </div>
          )}
          {still && run.video && (
            <button
              type="button"
              onClick={() => setStill(null)}
              className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-bg/85 px-2 py-1 text-xs text-txt backdrop-blur-sm hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Film className="size-3.5" aria-hidden /> Back to video
            </button>
          )}
        </div>

        {run.video && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={paused ? "Play" : "Pause"}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-txt transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
            {/* The track is the only scrubber: one segment per step, clamped to the video's length */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Run timeline"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalMs)}
              aria-valuenow={Math.round(now)}
              aria-valuetext={`${time(now)} of ${time(totalMs)}${currentStep ? `, step ${currentStep.index} of ${run.steps.length}: ${currentStep.name}` : ""}`}
              onKeyDown={onTrackKey}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e) }}
              onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e) }}
              className="group relative h-7 min-w-0 flex-1 cursor-pointer touch-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border2" />
              {timed && run.steps.map((s, i) => {
                const sp = spans[i]
                return (
                  <div
                    key={s.index}
                    title={`${String(s.index).padStart(2, "0")} ${s.name}`}
                    style={{ left: pct(sp.start), width: `max(4px, calc(${pct(sp.end - sp.start)} - 2px))` }}
                    className={cn(
                      "absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-transform duration-(--duration-fast) hover:scale-y-150",
                      s.status === "failed" ? "bg-danger" : "bg-teal/60",
                      current === s.index && "scale-y-150",
                      current === s.index && s.status === "passed" && "bg-teal",
                    )}
                  />
                )
              })}
              {failedSpan && (
                <span
                  className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger"
                  style={{ left: pct(failedSpan.at) }}
                  aria-hidden
                />
              )}
              <span ref={head} className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-txt" style={{ left: pct(now) }} aria-hidden>
                <span className="absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full bg-txt" />
              </span>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">
              <span className="text-txt">{time(now)}</span> / {time(totalMs)}
            </span>
          </div>
        )}
      </div>

      {failed?.error && (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
          <p className="text-xs font-medium text-danger">Failed at step {failed.index}: {failed.name}</p>
          <pre className="mt-1 max-h-40 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-danger/90">{failed.error}</pre>
        </div>
      )}

      {run.steps.length > 0 && (
        <ol className="flex flex-col" aria-label="Steps">
          {run.steps.map((s, i) => {
            const active = current === s.index
            const label = `step ${s.index}: ${s.name}`
            return (
              <li key={s.index} className={cn("-mx-2 flex items-center gap-1 rounded-md pr-2 transition-colors duration-(--duration-fast) hover:bg-surface2", active && "bg-surface2")}>
                <button
                  type="button"
                  onClick={() => goTo(s)}
                  aria-current={active || undefined}
                  aria-label={`${timed ? "Seek to" : "Show"} ${label}, ${s.status}`}
                  className="grid min-w-0 flex-1 grid-cols-[1rem_1.5rem_1fr_auto] items-center gap-x-2.5 rounded-md px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {s.status === "passed"
                    ? <Check className="size-4 text-teal" aria-hidden />
                    : <X className="size-4 text-danger" aria-hidden />}
                  <span className="font-mono text-[11px] text-muted tabular-nums">{String(s.index).padStart(2, "0")}</span>
                  <span className={cn("min-w-0 truncate text-[13px]", active ? "text-txt" : "text-txt/90")} title={s.name}>{s.name}</span>
                  <span className="font-mono text-[11px] text-muted tabular-nums">{timed ? time(spans[i].start) : ""}</span>
                </button>
                {s.screenshot ? (
                  <button
                    type="button"
                    onClick={() => setStill(s)}
                    aria-label={`Show the screenshot of ${label}`}
                    className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the runs API, not a static asset */}
                    <img
                      src={media(s.screenshot)}
                      alt=""
                      loading="lazy"
                      className={cn("aspect-video w-18 rounded-sm border bg-surface2 object-cover object-top", s.status === "failed" ? "border-danger/50" : "border-border")}
                    />
                  </button>
                ) : <span className="flex aspect-video w-18 shrink-0 items-center justify-center rounded-sm border border-border bg-surface2"><ImageOff className="size-3 text-muted" aria-hidden /></span>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
