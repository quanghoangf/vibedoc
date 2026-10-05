/**
 * Suite runs (R064), pure: one Playwright process runs many tasks' specs; `VIBEDOC_TASK_MAP` (JSON
 * `{ "<spec path relative to the Playwright cwd>": "T0xx" }`) says which task each spec records under.
 * Used by the fixture; the reporter keeps a copy of the lookup (it loads standalone). No fs, no imports.
 * Self-check: node src/lib/task-map.check.mts
 */

/** Forward slashes, no leading `./`: both sides of the lookup go through this. */
export const normSpecPath = (p: string) => p.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')

/** The env value → normalised map; null when absent or not a `{ path: "T…" }` object. */
export function parseTaskMap(json: string | undefined | null): Record<string, string> | null {
  if (!json) return null
  try {
    const raw = JSON.parse(json)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const out: Record<string, string> = {}
    for (const [file, task] of Object.entries(raw)) if (typeof task === 'string' && /^T\d+$/.test(task)) out[normSpecPath(file)] = task
    return out
  } catch {
    return null
  }
}

/** The task a spec file records under: the map's entry, else `fallback`. `file` is relative to the cwd. */
export function taskForFile(map: Record<string, string> | null, file: string, fallback: string): string {
  return map?.[normSpecPath(file)] ?? fallback
}
