// Automatic task dates (R055): due filled from the epic or the size, Started / Done stamped on moves.
// Pure (no React, no fs). Dates are local calendar strings "YYYY-MM-DD", never instants.
// Self-check: `node src/lib/auto-dates.check.mts`.

export type SizeDays = Record<string, number>

/** Calendar days of work per size letter; override with `tasks.sizeDays` in .vibedoc/settings.json. */
export const DEFAULT_SIZE_DAYS: SizeDays = { XS: 1, S: 1, M: 3, L: 7, XL: 14 }

/** "2026-10-01" + 3 → "2026-10-04" (calendar math, no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "M (2–3 hrs)" → "M"; "—" / "" → null. */
export function sizeLetter(size: string): string | null {
  return size.trim().match(/^(XS|XL|S|M|L)\b/i)?.[1].toUpperCase() ?? null
}

export interface TaskDates {
  due: string | null
  started: string | null
  done: string | null
}

/**
 * Dates after a move to `status` on `today`. Only fills what is empty, so a hand-set due always wins:
 * - in-progress: Started = today (first start only); no due yet → Started + the size's days
 * - done: Done = today
 * - back to anything else from done: Done is cleared (Started stays)
 */
export function datesOnMove(
  status: string, current: TaskDates, size: string, today: string, sizeDays: SizeDays = DEFAULT_SIZE_DAYS,
): TaskDates {
  const next = { ...current }
  if (status === "in-progress") {
    next.started ??= today
    const days = sizeDays[sizeLetter(size) ?? ""]
    if (!next.due && typeof days === "number" && days >= 0) next.due = addDays(next.started, days)
  }
  if (status === "done") next.done = today
  else if (next.done) next.done = null
  return next
}
