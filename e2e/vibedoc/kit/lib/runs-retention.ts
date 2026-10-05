/**
 * Run retention (R059): keep only the newest N runs of a task. Pure, no fs; the fixture deletes.
 * Self-check: node src/lib/runs-retention.check.mts
 */

export const DEFAULT_RUNS_KEEP = 5

/** `runs.keep` / `VIBEDOC_RUNS_KEEP` → a count ≥ 1. Unset or empty = 5; 0, negative or garbage = 1. */
export function parseKeep(v: unknown): number {
  if (v === undefined || v === null || v === '') return DEFAULT_RUNS_KEEP
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/**
 * The runIds to delete: all but the newest `keep` (runIds sort lexically by time, see runs-paths.ts `newRunId`).
 * `current` (the run being written) is never deleted and counts as one of the kept.
 */
export function planPrune(runIds: string[], keep: number, current?: string): string[] {
  const k = Math.max(1, Math.floor(keep) || 1)
  const others = [...new Set(runIds)].filter(id => id !== current).sort().reverse()
  return others.slice(current && runIds.includes(current) ? k - 1 : k)
}
