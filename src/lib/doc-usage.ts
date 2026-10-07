// R093: doc usage signals — which docs agents read, and what they searched for and didn't find.
// Pure: parse / record / summarize `.vibedoc/doc-usage.json`. core.ts does the file I/O.

export interface UsageCount { count: number; last: string }
export interface DocUsage {
  version: 1
  /** path → reads by agents (vibedoc_read_doc), coalesced per doc */
  reads: Record<string, UsageCount>
  /** normalized query → agent searches that found nothing */
  searches: Record<string, UsageCount & { query: string }>
}

export const MAX_READS = 500
export const MAX_SEARCHES = 100

export const emptyUsage = (): DocUsage => ({ version: 1, reads: {}, searches: {} })

function validCount(v: unknown): v is UsageCount {
  const c = v as UsageCount
  return !!c && typeof c === 'object' && Number.isInteger(c.count) && c.count > 0 && typeof c.last === 'string' && !Number.isNaN(Date.parse(c.last))
}

/** A bad or missing file is an empty record, never an error. */
export function parseUsage(raw: string | null): DocUsage {
  const out = emptyUsage()
  if (!raw) return out
  let data: { reads?: Record<string, unknown>; searches?: Record<string, unknown> }
  try { data = JSON.parse(raw) } catch { return out }
  if (!data || typeof data !== 'object') return out
  for (const [p, c] of Object.entries(data.reads ?? {})) if (validCount(c)) out.reads[p] = { count: c.count, last: c.last }
  for (const [k, c] of Object.entries(data.searches ?? {})) {
    const q = (c as { query?: unknown })?.query
    if (validCount(c) && typeof q === 'string') out.searches[k] = { query: q, count: c.count, last: c.last }
  }
  return out
}

/** Keeps the `max` newest entries (by `last`). */
function cap<T extends UsageCount>(rec: Record<string, T>, max: number): Record<string, T> {
  const entries = Object.entries(rec)
  if (entries.length <= max) return rec
  return Object.fromEntries(entries.sort((a, b) => b[1].last.localeCompare(a[1].last)).slice(0, max))
}

export function recordRead(usage: DocUsage, docPath: string, now: Date): DocUsage {
  const prev = usage.reads[docPath]
  const reads = { ...usage.reads, [docPath]: { count: (prev?.count ?? 0) + 1, last: now.toISOString() } }
  return { ...usage, reads: cap(reads, MAX_READS) }
}

export interface UsageSummary {
  /** read docs that still exist, most read first (ties: newest read first) */
  mostRead: { path: string; count: number; last: string }[]
  /** docs (kind "doc") no agent has read, in path order */
  neverRead: string[]
}

/** `paths` = every file in the project; `docPaths` = the ones that are docs (not tasks, epics, entries…). */
export function summarizeUsage(usage: DocUsage, paths: string[], docPaths: string[]): UsageSummary {
  const exists = new Set(paths)
  const mostRead = Object.entries(usage.reads)
    .filter(([p]) => exists.has(p))
    .map(([p, c]) => ({ path: p, count: c.count, last: c.last }))
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
  const neverRead = docPaths.filter((p) => !usage.reads[p]).sort()
  return { mostRead, neverRead }
}
