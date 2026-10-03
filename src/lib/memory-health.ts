// Pure memory health checks (R051, no fs): memory that contradicts the board, or names items that don't exist.
// Self-check: node src/lib/memory-health.check.mts

export type HealthKind = 'contradiction' | 'dangling-ref' | 'duplicate' | 'stale'
export type HealthFlag = {
  id: string            // stable key, e.g. "contradiction:working-on:T055", used for dismissing
  kind: HealthKind
  severity: 'warn' | 'info'
  message: string       // one line, shown as is in the UI and MCP output
  refs: string[]        // item ids involved (T055, E012, …)
  suggestion?: { action: 'merge' | 'delete'; ids: string[] }
}
export type BoardStatus = { id: string; status: string }   // tasks + roadmap items
/** Item ids mentioned in a text. core.ts passes memory-graph's extractRefs (pure libs don't import values from each other). */
export type RefsOf = (text: string) => string[]

type Section = 'working-on' | 'up-next' | 'just-completed'
// MEMORY.md headings written by updateMemory(): "## Working on now", "## Up next", "## Just completed"
const SECTION_RE: [Section, RegExp][] = [
  ['working-on', /^working on\b/i],
  ['up-next', /^up next\b/i],
  ['just-completed', /^just completed\b/i],
]
const CLOSED = new Set(['done', 'cancelled'])
const isBoardId = (id: string) => /^[TR]\d/.test(id)
const isEntryId = (id: string) => /^E\d/.test(id)

/** `## Heading` → body, in file order. Text before the first `##` is keyed ''. ``` fenced blocks are left out of every body. */
export function splitSections(markdown: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [{ heading: '', body: '' }]
  let inFence = false
  for (const line of markdown.split('\n')) {
    // a fenced block is an example: neither its `##` lines (same rule as manual-tests.ts / review.ts) nor its ids count
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const h = /^##\s+(.+?)\s*$/.exec(line)
    if (h) out.push({ heading: h[1], body: '' })
    else out[out.length - 1].body += line + '\n'
  }
  return out
}

/** Text without ``` fenced blocks and `inline code`: ids in code are examples (`/board?task=T055`), not mentions. */
export function prose(text: string): string {
  let inFence = false
  return text.split('\n').filter(line => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return false }
    return !inFence
  }).join('\n').replace(/`[^`\n]*`/g, '')
}

const sectionOf = (heading: string): Section | undefined => SECTION_RE.find(([, re]) => re.test(heading))?.[0]

export function findContradictions(
  handoff: string,
  entries: { id: string; body: string; summary: string }[],
  board: BoardStatus[],
  refsOf: RefsOf,
  others: { id: string; text: string }[] = [],
): HealthFlag[] {
  const status = new Map(board.map(b => [b.id, b.status]))
  const entryIds = new Set(entries.map(e => e.id))
  const flags = new Map<string, HealthFlag>()
  const add = (f: HealthFlag) => { if (!flags.has(f.id)) flags.set(f.id, f) }
  const dangling = (source: string, who: string, text: string, kinds: { board: boolean; entry: boolean }) => {
    for (const id of refsOf(prose(text))) {
      const missing = (kinds.board && isBoardId(id) && !status.has(id)) || (kinds.entry && isEntryId(id) && !entryIds.has(id))
      if (missing) add({ id: `dangling-ref:${source}:${id}`, kind: 'dangling-ref', severity: 'info', message: `${who} mentions ${id}, which doesn't exist`, refs: [id] })
    }
  }
  // a project without entries has no merged/deleted ids to point at; its E-ids are format examples, so skip them
  const entryRefs = entryIds.size > 0

  for (const { heading, body } of splitSections(handoff)) {
    dangling('handoff', 'Handoff', body, { board: true, entry: entryRefs })
    const section = sectionOf(heading)
    if (!section) continue
    for (const id of refsOf(prose(body)).filter(isBoardId)) {
      const s = status.get(id)
      if (s === undefined) continue
      if (section === 'just-completed') {
        // epics named here are usually context ("T117 of R051"), so only tasks must be done
        if (id.startsWith('T') && s !== 'done') {
          add({ id: `contradiction:${section}:${id}`, kind: 'contradiction', severity: 'warn', message: `Handoff says ${id} is done, but it is ${s}`, refs: [id] })
        }
      } else if (CLOSED.has(s)) {
        const says = section === 'working-on' ? 'in progress' : 'up next'
        add({ id: `contradiction:${section}:${id}`, kind: 'contradiction', severity: 'warn', message: `Handoff says ${id} is ${says}, but it is ${s}`, refs: [id] })
      }
    }
  }
  // done tasks in entries are fine (long-lived facts); only missing ids are flagged
  for (const e of entries) dangling(e.id, e.id, `${e.summary}\n${e.body}`, { board: true, entry: true })
  // tasks, roadmap items and docs that still name a merged or deleted entry (R051): those links now point nowhere
  if (entryRefs) for (const o of others) dangling(o.id, o.id, o.text, { board: false, entry: true })

  return [...flags.values()].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'warn' ? -1 : 1) ||
    a.refs[0].localeCompare(b.refs[0], 'en', { numeric: true }) ||
    a.id.localeCompare(b.id, 'en', { numeric: true }))
}

export const MAX_SESSION_WARNINGS = 5

/** The block vibedoc_read_memory shows under the handoff: warn flags (max 5), else one info line, else ''. */
export function formatHealthWarnings(flags: HealthFlag[]): string {
  const warns = flags.filter(f => f.severity === 'warn')
  if (!warns.length) {
    const n = flags.length
    return n ? `ℹ ${n} memory cleanup ${n === 1 ? 'suggestion' : 'suggestions'} on /memory` : ''
  }
  const more = warns.length - MAX_SESSION_WARNINGS
  return ['## ⚠ Memory warnings', ...warns.slice(0, MAX_SESSION_WARNINGS).map(f => `- ⚠ ${f.message}`),
    ...(more > 0 ? [`…and ${more} more on /memory`] : [])].join('\n')
}

// ─── Duplicates ───────────────────────────────────────────────────────────────

export type DupEntry = { id: string; type: string; summary: string; body: string }
/** recall.ts's tokenize, passed in by core.ts (pure libs don't import values from each other) so stopwords match recall. */
export type Tokenize = (s: string) => string[]

// Threshold 0.5, picked with the self-check fixture: "Only core.ts touches the file system" / "Only core.ts may touch fs"
// scores 0.57, near misses sharing one topic word ("core.ts owns the activity log") stay ≤ 0.25.
export const DUPLICATE_THRESHOLD = 0.5
const TYPE_PENALTY = 0.1
// modal fillers that say nothing about the topic ("may touch" vs "touches")
const FILLER = new Set(['may', 'must', 'should'])
// ponytail: suffix strip on top of recall's plural strip ("touche" → "touch"); a real stemmer if pairs slip through
const stem = (t: string) => (t.length > 4 ? t.replace(/(ing|ed|es|e)$/, '') : t)

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size && !b.size) return 0
  let common = 0
  for (const t of a) if (b.has(t)) common++
  return common / (a.size + b.size - common)
}
const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

type DupSets = { type: string; summary: Set<string>; all: Set<string> }
const dupSets = (e: DupEntry, tokenize: Tokenize): DupSets => {
  const set = (s: string) => new Set(tokenize(s).map(stem).filter(t => !FILLER.has(t)))
  return { type: e.type, summary: set(e.summary), all: set(`${e.summary}\n${e.body}`) }
}
const scoreSets = (a: DupSets, b: DupSets) => {
  const score = 0.6 * jaccard(a.summary, b.summary) + 0.4 * jaccard(a.all, b.all)
  return a.type === b.type ? score : score - TYPE_PENALTY
}

/** 0.6·J(summary) + 0.4·J(summary + body), minus 0.1 when the types differ. */
export function duplicateScore(a: DupEntry, b: DupEntry, tokenize: Tokenize): number {
  return scoreSets(dupSets(a, tokenize), dupSets(b, tokenize))
}

/** Entries that say the same thing, grouped transitively (E1~E2, E2~E3 → one flag). Score shown = the strongest pair. */
export function findDuplicates(entries: DupEntry[], tokenize: Tokenize, opts: { threshold?: number } = {}): HealthFlag[] {
  const threshold = opts.threshold ?? DUPLICATE_THRESHOLD
  const parent = entries.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const best = new Map<number, number>()
  const sets = entries.map(e => dupSets(e, tokenize))   // tokenize each entry once, not once per pair
  // ponytail: O(n²) pairs, fine up to a few hundred entries; bucket by shared summary token if memory grows past that
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const s = scoreSets(sets[i], sets[j])
      if (s < threshold) continue
      parent[find(j)] = find(i)
      best.set(i, Math.max(best.get(i) ?? 0, s))
    }
  }
  const groups = new Map<number, { ids: string[]; score: number }>()
  entries.forEach((e, i) => {
    const g = groups.get(find(i)) ?? { ids: [], score: 0 }
    g.ids.push(e.id)
    g.score = Math.max(g.score, best.get(i) ?? 0)
    groups.set(find(i), g)
  })
  return [...groups.values()].filter(g => g.ids.length > 1).map(({ ids, score }) => {
    ids.sort(byId)
    const names = ids.length === 2 ? ids.join(' and ') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`
    return {
      id: `duplicate:${ids.join('+')}`, kind: 'duplicate' as const, severity: 'info' as const,
      message: `${names} look like duplicates (${Math.round(score * 100)}%)`,
      refs: ids, suggestion: { action: 'merge' as const, ids },
    }
  }).sort((a, b) => byId(a.refs[0], b.refs[0]))
}

// ─── Not recalled lately ──────────────────────────────────────────────────────

/** `memory/.recall-log.json`: entry id → the YYYY-MM-DD an agent last fetched its body (vibedoc_get_entries). */
export type RecallLog = Record<string, string>
export const STALE_DAYS = 60

// local calendar dates, compared as UTC midnights so DST never shifts a day
const dayNumber = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000
const isDate = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)

/**
 * Entries nobody has recalled in more than `days` days (default 60). Age = days since the last recall, or since
 * `updatedAt` when never recalled or edited after the last recall, so a brand-new or just-edited entry is never stale.
 */
export function findStale(
  entries: { id: string; updatedAt: string }[], recallLog: RecallLog, today: string, opts: { days?: number } = {},
): HealthFlag[] {
  const days = opts.days ?? STALE_DAYS
  const flags: HealthFlag[] = []
  for (const e of entries) {
    const recalled = isDate(recallLog[e.id]) ? recallLog[e.id] : undefined
    const since = [recalled, isDate(e.updatedAt) ? e.updatedAt : undefined].filter(isDate).sort().pop()
    if (!since) continue
    const age = dayNumber(today) - dayNumber(since)
    if (age <= days) continue
    const ago = (d: string) => { const n = dayNumber(today) - dayNumber(d); return `${n} ${n === 1 ? 'day' : 'days'} ago` }
    flags.push({
      id: `stale:${e.id}`, kind: 'stale', severity: 'info',
      message: recalled ? `${e.id} last recalled ${ago(recalled)}` : `${e.id} never recalled (updated ${ago(since)})`,
      refs: [e.id], suggestion: { action: 'delete', ids: [e.id] },
    })
  }
  return flags.sort((a, b) => byId(a.refs[0], b.refs[0]))
}

/** The log after `ids` were recalled on `today`, or null when nothing changes (so the file isn't rewritten). Sorted keys. */
export function markRecalled(log: RecallLog, ids: string[], today: string): RecallLog | null {
  if (ids.every(id => log[id] === today)) return null
  return sortedLog({ ...log, ...Object.fromEntries(ids.map(id => [id, today])) })
}

/**
 * Dismissals without the flags that name an entry id that is gone (deleted or merged away), so a later entry that
 * reuses the id doesn't inherit them. Null when nothing changes. Flag ids: stale:E1, dangling-ref:E1:T9, duplicate:E1+E2.
 */
export function pruneDismissed(dismissed: Record<string, string>, goneIds: string[]): Record<string, string> | null {
  const gone = new Set(goneIds)
  const names = (flagId: string): string[] => {
    const i = flagId.indexOf(':')
    const kind = flagId.slice(0, i), rest = flagId.slice(i + 1)
    if (kind === 'stale') return [rest]
    if (kind === 'duplicate') return rest.split('+')
    if (kind === 'dangling-ref') return [rest.slice(0, rest.lastIndexOf(':')), rest.slice(rest.lastIndexOf(':') + 1)]
    return []
  }
  const kept = Object.entries(dismissed).filter(([f]) => !names(f).some(id => gone.has(id)))
  return kept.length === Object.keys(dismissed).length ? null : Object.fromEntries(kept)
}

export const sortedLog = (log: RecallLog): RecallLog =>
  Object.fromEntries(Object.entries(log).sort(([a], [b]) => byId(a, b)))
