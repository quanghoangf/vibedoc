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

export interface TimelineMarker { item: RoadmapItem; x: number; row: number; state: DueState | null; horizon: boolean }
export interface TimelineLane { item: RoadmapItem; rows: number; markers: TimelineMarker[] }
export interface Timeline {
  months: { label: string; x: number }[]
  width: number
  todayX: number
  lanes: TimelineLane[]
  undated: RoadmapItem[]
}

/** `monthName` labels the axis in the UI language (useFormat().month). */
export function buildTimeline(items: RoadmapItem[], today: string, monthName: (m: number) => string): Timeline {
  const dues = items.map((i) => i.due).filter((d): d is string => !!d)
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
    const dated = [h, ...(h.parent === null ? childrenOf(items, h.id) : [])].filter((i) => i.due)
    const rowEnds: number[] = []
    const markers = dated
      .map((item) => ({ item, x: xOf(item.due as string), horizon: item.id === h.id }))
      .sort((a, b) => a.x - b.x)
      .map((mk) => {
        // greedy: first row whose last label ends before this marker
        let row = rowEnds.findIndex((end) => mk.x >= end)
        if (row === -1) row = rowEnds.push(0) - 1
        rowEnds[row] = mk.x + LABEL_W
        return { ...mk, row, state: dueState(mk.item.due, mk.item.status, today) }
      })
    return { item: h, rows: Math.max(1, rowEnds.length), markers }
  })

  return {
    months: months.map(({ label, x }) => ({ label, x })),
    width: span * MONTH_W,
    todayX: xOf(today),
    lanes,
    undated: items.filter((i) => !i.due && i.status !== "done"), // shipped work needs no date
  }
}
