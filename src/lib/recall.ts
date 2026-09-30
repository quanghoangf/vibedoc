// Pure keyword recall over knowledge entries (R048, no fs). Self-check: node src/lib/recall.check.mts
// Index first, bodies on request: agents get compact lines here and fetch bodies with vibedoc_get_entries.

export type RecallEntry = { id: string; type: string; summary: string; body: string; updatedAt: string }
export type RecallHit = { id: string; type: string; summary: string; tokens: number; score: number }

const STOPWORDS = new Set(('a an and are as at be but by can do does for from how i if in into is it its of on or ' +
  'our so that the their then there these this to use used using was we what when where which who why will with you your').split(' '))

/** Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens, naive plural strip ("events" → "event"). */
export function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    // ponytail: plural strip only, no real stemmer; add one if recall misses obvious matches
    .map(t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
}

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4)
}

/** Per query token: +3 in summary, +2 matches id or type, +1 in body. Score 0 dropped; ties → newest first. */
export function rankEntries(entries: RecallEntry[], query: string, opts: { type?: string; limit?: number } = {}): RecallHit[] {
  const q = [...new Set(tokenize(query))]
  if (!q.length) return []
  const hits: (RecallHit & { updatedAt: string })[] = []
  for (const e of entries) {
    if (opts.type && e.type !== opts.type) continue
    const summary = new Set(tokenize(e.summary))
    const body = new Set(tokenize(e.body))
    const idType = new Set([e.id.toLowerCase(), ...tokenize(e.type)])
    let score = 0
    for (const t of q) {
      if (summary.has(t)) score += 3
      if (idType.has(t)) score += 2
      if (body.has(t)) score += 1
    }
    if (score > 0) {
      hits.push({ id: e.id, type: e.type, summary: e.summary, tokens: estimateTokens(`${e.summary}\n${e.body}`), score, updatedAt: e.updatedAt })
    }
  }
  hits.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
  return hits.slice(0, opts.limit ?? 10).map(({ updatedAt: _, ...h }) => h)
}

/** "E012 · convention · Only core.ts touches fs (~120 tok)" */
export function formatCompactLine(h: RecallHit): string {
  return `${h.id} · ${h.type} · ${h.summary} (~${h.tokens} tok)`
}

/** Every entry as a compact hit, newest first: the session-start index order. */
export function indexHits(entries: RecallEntry[]): RecallHit[] {
  return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map(e => ({ id: e.id, type: e.type, summary: e.summary, tokens: estimateTokens(`${e.summary}\n${e.body}`), score: 0 }))
}

export const DEFAULT_SESSION_BUDGET = 2000
const INDEX_HINT = 'Save new facts with vibedoc_save_entry; fetch bodies with vibedoc_get_entries.'

/**
 * Session start = the whole handoff + as many index lines (in the order given) as fit `budget` tokens,
 * then "+N more" when some were left out. Header, footer and hint count toward the budget. The handoff is never cut.
 */
export function fitToBudget(handoff: string, index: RecallHit[], budget: number):
  { text: string; shown: number; omitted: number; tokens: number } {
  const render = (n: number, warning?: string) => [
    handoff.trimEnd(), '',
    ...(warning ? [warning] : []),
    `## Knowledge entries (${index.length})`,
    ...index.slice(0, n).map(formatCompactLine),
    ...(n < index.length ? [`+${index.length - n} more entries — use vibedoc_recall { query }`] : []),
    INDEX_HINT,
  ].join('\n')
  const fits = (n: number) => estimateTokens(render(n)) <= budget
  let text: string
  let shown = 0
  if (!fits(0)) {
    text = render(0, `⚠️ The handoff alone is ~${estimateTokens(handoff)} tokens, over the ${budget}-token session budget: trim memory/MEMORY.md.`)
  } else {
    // ponytail: re-renders per line (O(n²) chars); fine for hundreds of entries
    while (shown < index.length && fits(shown + 1)) shown++
    text = render(shown)
  }
  return { text, shown, omitted: index.length - shown, tokens: estimateTokens(text) }
}

export const RELATED_MIN_SCORE = 3
const GOAL_CHARS = 500

/** Recall query for a task: its title, the first 500 chars of its Goal, and the Phase epic title (id dropped). */
export function taskQuery(task: { title: string; phase?: string; raw?: string }): string {
  const goal = /^## Goal[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(task.raw ?? '')?.[1].trim() ?? ''
  const epic = (task.phase ?? '').replace(/^R\d+\s*[—–-]\s*/, '')
  return [task.title, goal.slice(0, GOAL_CHARS), epic].filter(Boolean).join(' ')
}

/** Only strong matches (at least one summary hit) → "## Related memory" block; '' when none qualify. */
export function formatRelated(hits: RecallHit[], limit = 3): string {
  const strong = hits.filter(h => h.score >= RELATED_MIN_SCORE).slice(0, limit)
  if (!strong.length) return ''
  return `## Related memory\n${strong.map(formatCompactLine).join('\n')}\nFetch with vibedoc_get_entries`
}
