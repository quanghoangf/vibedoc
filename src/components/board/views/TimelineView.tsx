"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { ActivityEvent, Task } from "@/types"
import {
  depOutline, foldAxis, timelineBars,
  type AxisSegment, type TimelineBar, type TimelineScale, type ViewState,
} from "@/lib/board-views"
import { useLang, useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { useCategoryLabel } from "@/components/shared/StatusIcon"
import { useTaskGroups } from "./useTaskGroups"
import { formatDate, type Lang } from "@/lib/i18n"

interface ViewProps {
  tasks: Task[]
  allTasks: Task[]
  state: ViewState
  agentTasks: Set<string>
  onOpenTask: (task: Task) => void
}

export interface TimelineViewProps extends ViewProps {
  events: ActivityEvent[]
  loading: boolean
  onScale: (s: TimelineScale) => void
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const FOLD_GAP = 30 * MIN
const FOLD_W = 56
const SEG_MIN_W = 170
const ACTIVE_PX_PER_MIN = 2.2
/** Sticky lane-label gutter: --gw is 110px on phones, 220px from sm up. */
const GUTTER = "[--gw:110px] sm:[--gw:220px]"
const ROW_H = 20
const LANE_PAD = 10
const HEAD_H = 28
const TRAIL_W = 200

const SCALES: { value: TimelineScale; label: MessageKey }[] = [
  { value: "active", label: "board.scaleActive" },
  { value: "day", label: "board.scaleDay" },
  { value: "week", label: "board.scaleWeek" },
]

/** A laid-out axis stretch: [startMs, endMs] drawn at x … x + width. */
interface Seg extends AxisSegment { x: number; width: number }

// English keeps the formats it had before R078 (24h en-GB clock, en-US "Oct 6"); other languages use their own
const hm = (lang: Lang, ms: number) => formatDate(lang, ms, { hour: "2-digit", minute: "2-digit", hour12: false }, "en-GB")
const md = (lang: Lang, ms: number) => formatDate(lang, ms, { month: "short", day: "numeric" }, "en-US")
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }

function gapLabel(ms: number) {
  const m = Math.round(ms / MIN)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h >= 24) return `${Math.round(m / 60)}h`
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

function segLabel(lang: Lang, s: AxisSegment) {
  return md(lang, s.startMs) === md(lang, s.endMs)
    ? `${md(lang, s.startMs)} · ${hm(lang, s.startMs)}–${hm(lang, s.endMs)}`
    : `${md(lang, s.startMs)} ${hm(lang, s.startMs)} – ${md(lang, s.endMs)} ${hm(lang, s.endMs)}`
}

/** `**Due:** YYYY-MM-DD` is a local calendar date: build it from parts, never `new Date("YYYY-MM-DD")`. */
function dueMs(due: string | null) {
  const m = due?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null
}

function layoutAxis(bars: TimelineBar[], scale: TimelineScale, now: number): Seg[] {
  if (!bars.length) return []
  if (scale === "active") {
    let x = 0
    return foldAxis(bars, FOLD_GAP).map((s, i) => {
      if (i > 0) x += FOLD_W
      const width = Math.max(SEG_MIN_W, ((s.endMs - s.startMs) / MIN) * ACTIVE_PX_PER_MIN)
      const seg = { ...s, x, width }
      x += width
      return seg
    })
  }
  const lo = Math.min(...bars.map((b) => b.startMs))
  const hi = Math.max(...bars.map((b) => b.endMs), bars.some((b) => b.open) ? now : 0)
  const startMs = startOfDay(lo)
  const endMs = startOfDay(hi) + DAY
  const pxPerMs = scale === "day" ? 40 / HOUR : 120 / DAY
  return [{ startMs, endMs, x: 0, width: (endMs - startMs) * pxPerMs }]
}

/** Pixel x for a moment, or null when it falls outside the axis (e.g. inside a folded gap). */
function xAt(segs: Seg[], ms: number): number | null {
  for (const s of segs) {
    if (ms >= s.startMs && ms <= s.endMs) {
      const span = s.endMs - s.startMs || 1
      return s.x + ((ms - s.startMs) / span) * s.width
    }
  }
  return null
}

function ticks(lang: Lang, segs: Seg[], scale: TimelineScale): { x: number; label: string | null }[] {
  const out: { x: number; label: string | null }[] = []
  for (const s of segs) {
    const dur = s.endMs - s.startMs
    const step = scale === "week" ? DAY : scale === "day" ? 6 * HOUR : dur <= 3 * HOUR ? 30 * MIN : dur <= 8 * HOUR ? HOUR : 3 * HOUR
    // Day/week ticks start at local midnight; active ticks at the first round step inside the segment.
    const first = scale === "active" ? Math.ceil(s.startMs / step) * step : s.startMs
    for (let t = first; t <= s.endMs; t += step) {
      const x = xAt([s], t)
      if (x == null) continue
      out.push({ x, label: scale === "week" ? md(lang, t) : scale === "day" ? (hm(lang, t) === "00:00" ? md(lang, t) : hm(lang, t)) : null })
    }
  }
  return out
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default function TimelineView({ tasks, state, agentTasks, onOpenTask, events, loading, onScale }: TimelineViewProps) {
  const now = useNow()
  const { lang } = useLang()
  const { t } = useT()
  const categoryLabel = useCategoryLabel()
  const groupTasks = useTaskGroups()
  const scale = state.scale

  const bars = useMemo(() => timelineBars(tasks, events, now), [tasks, events, now])
  const segs = useMemo(() => layoutAxis(bars, scale, now), [bars, scale, now])
  const tickList = useMemo(() => ticks(lang, segs, scale), [lang, segs, scale])
  const lanes = useMemo(() => {
    const barBy = new Map(bars.map((b) => [b.taskId, b]))
    return groupTasks(tasks, state.group).map((g) => {
      const worked = g.tasks.filter((t) => barBy.has(t.id))
        .map((t) => ({ task: t, bar: barBy.get(t.id) as TimelineBar }))
        .sort((a, b) => a.bar.startMs - b.bar.startMs)
      const openTasks = g.tasks.filter((t) => !barBy.has(t.id) && t.status !== "done" && t.status !== "cancelled")
      const planned = depOutline(openTasks).map((o) => o.task)
      // A finished epic's bars share one compact row (no labels; the bar titles carry them).
      const compact = !planned.length && g.tasks.every((t) => t.status === "done" || t.status === "cancelled")
      return { group: g, worked, planned, compact }
    }).filter((l) => l.worked.length || l.planned.length)
  }, [tasks, bars, state.group, groupTasks])

  const axisW = segs.length ? segs[segs.length - 1].x + segs[segs.length - 1].width : 0
  const canvasW = axisW + TRAIL_W
  const nowX = xAt(segs, now)
  const lastSegX = segs.length ? segs[segs.length - 1].x : null

  // Once per scale, bring the now line into view, or the latest work when now is past the axis.
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledFor = useRef<TimelineScale | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || lastSegX == null || scrolledFor.current === scale) return
    scrolledFor.current = scale
    const gutter = el.querySelector<HTMLElement>("[data-gutter]")?.offsetWidth ?? 0
    // No now line: show the latest segment from its start (on a phone it is wider than the view)
    el.scrollLeft = nowX != null ? nowX - (el.clientWidth - gutter) / 2 : Math.min(el.scrollWidth - el.clientWidth, lastSegX - 16)
  }, [nowX, scale, lastSegX])

  const scaleControl = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted max-sm:hidden">{t("board.scale")}</span>
      <div role="group" aria-label={t("board.timelineScale")} className="flex rounded-md border border-border p-0.5">
        {SCALES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={scale === s.value}
            onClick={() => onScale(s.value)}
            className={cn(
              "h-6 rounded-[5px] border border-transparent px-2.5 text-xs font-medium text-muted outline-none transition-colors duration-(--duration-fast) ease-out-soft",
              "hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
              scale === s.value && "border-border2 bg-surface2 text-txt",
            )}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      {scale === "active" && <span className="ml-2 text-xs text-muted max-sm:hidden">{t("board.idleFolded")}</span>}
    </div>
  )

  if (!tasks.length) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">{scaleControl}</div>
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-txt">{t("board.noMatch")}</p>
          <p className="mt-1 text-xs text-muted">{t("board.noMatchTimelineHint")}</p>
        </div>
      </div>
    )
  }

  if (loading && !events.length) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("board.loadingTimeline")}>
        <div className="flex justify-end">{scaleControl}</div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 border-b border-border pb-4">
            <div className="h-9 w-[200px] animate-pulse rounded bg-surface2" />
            <div className="flex flex-1 flex-col gap-1.5 pt-1">
              <div className="h-3.5 w-1/3 animate-pulse rounded-sm bg-surface2" style={{ marginLeft: `${10 + i * 15}%` }} />
              <div className="h-3.5 w-1/5 animate-pulse rounded-sm bg-surface2" style={{ marginLeft: `${30 + i * 10}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const hasDue = tasks.some((t) => t.due)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex justify-end">{scaleControl}</div>

      {!bars.length && (
        <p className="text-sm text-muted">
          {t("board.noMoves")}
        </p>
      )}

      <div ref={scrollRef} className="min-w-0 overflow-x-auto overscroll-x-contain">
        <div className={cn("relative", GUTTER)} style={{ width: `calc(var(--gw) + ${canvasW}px)` }}>
          {/* Axis header */}
          <div className="flex" style={{ height: HEAD_H + 8 }}>
            <div data-gutter className="sticky left-0 z-20 w-(--gw) shrink-0 bg-bg" />
            <div className="relative" style={{ width: canvasW }}>
              {segs.map((s, i) => (
                <div key={s.startMs}>
                  {scale === "active" && (
                    <div
                      className="absolute bottom-0 truncate border-b border-border2 font-mono text-[11px] text-txt"
                      style={{ left: s.x, width: s.width, height: HEAD_H }}
                    >
                      {segLabel(lang, s)}
                    </div>
                  )}
                  {scale === "active" && i > 0 && (
                    <span
                      className="absolute bottom-0 flex justify-center font-mono text-[10px] whitespace-nowrap text-muted"
                      style={{ left: s.x - FOLD_W, width: FOLD_W, height: HEAD_H }}
                      title={t("board.idleGap", { gap: gapLabel(s.startMs - segs[i - 1].endMs) })}
                    >
                      {gapLabel(s.startMs - segs[i - 1].endMs)}
                    </span>
                  )}
                </div>
              ))}
              {scale !== "active" && segs.length > 0 && (
                <div className="absolute bottom-0 border-b border-border2" style={{ left: 0, width: axisW, height: HEAD_H }}>
                  {tickList.map((t) => t.label && (
                    <span key={t.x} className="absolute top-0 pl-1 font-mono text-[11px] whitespace-nowrap text-txt" style={{ left: t.x }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
              {nowX != null && (
                <span
                  className="absolute top-0 z-10 -translate-x-1/2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-fg"
                  style={{ left: nowX }}
                >
                  {hm(lang, now)}
                </span>
              )}
            </div>
          </div>

          {/* Lanes */}
          {lanes.map(({ group, worked, planned, compact }, laneIndex) => {
            const rows = compact ? 1 : worked.length + planned.length
            const height = Math.max(52, rows * ROW_H + LANE_PAD * 2)
            const lastEnd = worked.reduce<number | null>((max, w) => {
              const x = xAt(segs, w.bar.endMs)
              return x == null ? max : Math.max(max ?? 0, x)
            }, null)
            const plannedX = (lastEnd ?? nowX ?? 0) + 8
            return (
              <section key={group.key} className="flex border-b border-border" aria-label={group.epicId ? `${group.epicId} ${group.label}` : group.label}>
                <div className="sticky left-0 z-20 flex w-(--gw) shrink-0 flex-col gap-0.5 bg-bg py-2.5 pr-2 sm:pr-4">
                  {group.epicId && <span className="font-mono text-[11px] text-muted">{group.epicId}</span>}
                  <span className="line-clamp-2 text-[13px] leading-tight font-semibold text-txt sm:line-clamp-none" title={group.label}>{group.label}</span>
                </div>
                <div className="relative" style={{ width: canvasW, height }}>
                  {tickList.map((t) => (
                    <span key={t.x} aria-hidden className="absolute inset-y-0 w-px bg-border opacity-60" style={{ left: t.x }} />
                  ))}
                  {scale === "active" && segs.slice(1).map((s) => (
                    <span key={s.startMs} aria-hidden className="absolute inset-y-0 border-l border-dashed border-border2" style={{ left: s.x - FOLD_W / 2 }} />
                  ))}
                  {nowX != null && <span aria-hidden className="absolute inset-y-0 z-10 w-px bg-accent" style={{ left: nowX }} />}

                  {worked.map(({ task, bar }, i) => {
                    const x0 = xAt(segs, bar.startMs) ?? 0
                    const x1 = xAt(segs, bar.endMs) ?? x0
                    const w = Math.max(4, x1 - x0)
                    const top = LANE_PAD + (compact ? 0 : i) * ROW_H
                    const agent = agentTasks.has(task.id)
                    const live = bar.open && bar.status === "in-progress"
                    const label = live
                      ? t("board.barLive", { id: task.id, time: hm(lang, bar.startMs) })
                      : bar.open
                      ? t("board.barOpen", { id: task.id, status: categoryLabel(bar.status).toLowerCase(), date: md(lang, bar.startMs), time: hm(lang, bar.startMs) })
                      : t("board.barWorked", { id: task.id, date: md(lang, bar.startMs), start: hm(lang, bar.startMs), end: hm(lang, bar.endMs) })
                    const due = dueMs(task.due)
                    const dueX = due == null ? null : xAt(segs, due)
                    return (
                      <div key={task.id}>
                        <button
                          type="button"
                          title={`${label} — ${task.title}`}
                          aria-label={`${label} — ${task.title}`}
                          onClick={() => onOpenTask(task)}
                          className={cn(
                            "absolute h-3.5 origin-left animate-grow-x rounded-[3px] outline-none transition-opacity duration-(--duration-fast) ease-out-soft hover:opacity-80",
                            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
                            live ? "bg-amber" : bar.status === "done" ? "bg-teal" : "bg-border2",
                          )}
                          // Worked time draws in from its start, one lane after another (capped at 240ms)
                          style={{ left: x0, width: w, top: top + 3, animationDelay: `${Math.min(laneIndex * 40, 240)}ms` }}
                        />
                        {!compact && (
                          <span
                            className={cn("pointer-events-none absolute font-mono text-[10px] leading-[14px] whitespace-nowrap", live ? "text-txt" : "text-muted")}
                            style={{ left: x0 + w + 6, top: top + 3 }}
                          >
                            {task.id}{live && ` · ${agent ? t("board.agentWorking") : t("board.inProgressSuffix")}`}
                          </span>
                        )}
                        {dueX != null && <DueMark x={dueX} top={top + 3} label={t("board.dueOn", { date: task.due ?? "" })} />}
                      </div>
                    )
                  })}

                  {planned.map((task, i) => {
                    const top = LANE_PAD + (worked.length + i) * ROW_H
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onOpenTask(task)}
                        title={t("board.plannedTitle", { id: task.id, title: task.title })}
                        aria-label={t("board.plannedTitle", { id: task.id, title: task.title })}
                        className="group absolute flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        style={{ left: plannedX, top: top + 3 }}
                      >
                        <span aria-hidden className="h-3.5 w-6 rounded-[3px] border border-dashed border-muted transition-colors duration-(--duration-fast) group-hover:border-txt" />
                        <span className="font-mono text-[10px] leading-[14px] whitespace-nowrap text-txt">{t("board.planned", { id: task.id })}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-[18px] rounded-sm bg-teal" />{t("board.legendWorked")}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-[18px] rounded-sm bg-amber" />{t("board.legendNow")}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-[18px] rounded-sm border border-dashed border-muted" />{t("board.legendPlanned")}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rotate-45 border border-txt" />{hasDue ? t("board.dueDate") : t("board.dueDateNone")}</span>
      </div>
    </div>
  )
}

function DueMark({ x, top, label }: { x: number; top: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="absolute size-2.5 -translate-x-1/2 rotate-45 border border-txt bg-bg"
      style={{ left: x, top: top + 2 }}
    />
  )
}
