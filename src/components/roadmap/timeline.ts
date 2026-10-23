import type { RoadmapItem } from "@/types"
import { dueState, type DueState } from "@/lib/roadmap-health"
import { childrenOf, spineItems } from "./layout"

export const MONTH_W = 160
export const LANE_ROW_H = 44
const LABEL_W = 180 // horizontal room a marker's label needs before the next one fits on the same row
const MIN_MONTHS = 6

// Dates are "YYYY-MM-DD" calendar dates — parsed by hand, never via new Date(string) (UTC shift).
const ymd = (d: string) => ({ y: +d.slice(0, 4), m: +d.slice(5, 7), day: +d.slice(8, 10) })
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate()

/**
 * `x` = the due date, or for a `derived` marker (no Due) the end of the span its tasks' Started → Done dates cover
 * (today while a task is open); `startX`/`start`/`end` describe that span (startX = x for a due marker).
 */
export interface TimelineMarker {
  item: RoadmapItem; x: number; startX: number; row: number; state: DueState | null; horizon: boolean
  derived: boolean; start: string | null; end: string | null
}
/** A task's `**Started:**` / `**Done:**` dates, keyed by task id. */
export type TaskDates = Record<string, { started: string | null; finished: string | null } | undefined>
export interface TimelineLane { item: RoadmapItem; rows: number; markers: TimelineMarker[] }
export interface Timeline {
  months: { label: string; x: number }[]
  width: number
  todayX: number
  lanes: TimelineLane[]
  undated: RoadmapItem[]
}

/**
 * `monthName` labels the axis in the UI language (useFormat().month). `axisDates` widen the axis only (no markers):
 * a group roadmap (R102) passes every repo's due dates, so each repo's timeline shares one month axis.
 */
export function buildTimeline(
  items: RoadmapItem[], today: string, monthName: (m: number) => string, axisDates: string[] = [], taskDates: TaskDates = {},
): Timeline {
  const spans = new Map<string, { start: string; end: string }>()
  for (const i of items) if (!i.due) { const s = derivedSpan(i, items, taskDates, today); if (s) spans.set(i.id, s) }
  const dues = [...items.map((i) => i.due), ...[...spans.values()].flatMap((s) => [s.start, s.end]), ...axisDates].filter((d): d is string => !!d)
  const first = ymd([today, ...dues].sort()[0])
  const last = ymd([today, ...dues].sort().at(-1) ?? today)

  // pad one month each side, then stretch to a readable minimum
  const start = { y: first.y, m: first.m - 1 }
  const span = Math.max(MIN_MONTHS, (last.y - first.y) * 12 + (last.m - first.m) + 3)
  const months = Array.from({ length: span }, (_, i) => {
    const t = start.y * 12 + (start.m - 1) + i
    const y = Math.floor(t / 12)
    const m = (t % 12) + 1
    return { y, m, label: m === 1 || i === 0 ? `${monthName(m)} ${y}` : monthName(m), x: i * MONTH_W }
  })

  const xOf = (d: string) => {
    const { y, m, day } = ymd(d)
    const idx = (y - months[0].y) * 12 + (m - months[0].m)
    return idx * MONTH_W + ((day - 0.5) / daysIn(y, m)) * MONTH_W
  }

  const lanes = spineItems(items).map((h) => {
    const dated = [h, ...(h.parent === null ? childrenOf(items, h.id) : [])].filter((i) => i.due || spans.has(i.id))
    const rowEnds: number[] = []
    const markers = dated
      .map((item) => {
        const span = item.due ? null : spans.get(item.id) ?? null
        const x = xOf(item.due ?? (span as { end: string }).end)
        return { item, x, startX: span ? xOf(span.start) : x, horizon: item.id === h.id, derived: !!span, start: span?.start ?? null, end: span?.end ?? null }
      })
      .sort((a, b) => a.startX - b.startX || a.x - b.x)
      .map((mk) => {
        // greedy: first row whose last label ends before this marker (a span occupies its whole bar)
        let row = rowEnds.findIndex((end) => mk.startX >= end)
        if (row === -1) row = rowEnds.push(0) - 1
        rowEnds[row] = mk.x + LABEL_W
        return { ...mk, row, state: mk.derived ? null : dueState(mk.item.due, mk.item.status, today) }
      })
    return { item: h, rows: Math.max(1, rowEnds.length), markers }
  })

  return {
    months: months.map(({ label, x }) => ({ label, x })),
    width: span * MONTH_W,
    todayX: xOf(today),
    lanes,
    undated: items.filter((i) => !i.due && !spans.has(i.id) && i.status !== "done"), // shipped work needs no date
  }
}

/**
 * The span an item without a Due covers, from its tasks' Started / Done dates (a horizon: its epics' tasks):
 * earliest Started → latest Done, or today while any of those tasks is still open. null = no task started yet.
 */
export function derivedSpan(item: RoadmapItem, items: RoadmapItem[], taskDates: TaskDates, today: string): { start: string; end: string } | null {
  const ids = item.parent === null ? [...item.tasks, ...childrenOf(items, item.id).flatMap((c) => c.tasks)] : item.tasks
  const known = ids.map((id) => taskDates[id]).filter((d) => !!d)
  const starts = known.map((d) => d.started ?? d.finished).filter((d): d is string => !!d).sort()
  if (!starts.length) return null
  const open = known.some((d) => !d.finished)
  const end = open ? today : known.map((d) => d.finished as string).sort().at(-1) as string
  return { start: starts[0], end: end < starts[0] ? starts[0] : end }
}
