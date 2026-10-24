// Pure cross-project search (R107, no fs). Self-check: node src/lib/cross-search.check.mts
// Each project is ranked on its own (docs: rankDocs' score, entries: rankEntries' score, tasks/epics: rankItems),
// then merged here. Tokenizing is recall.ts's `tokenize`, passed in by core. No vector search (by design, R048).

export type CrossKind = 'doc' | 'task' | 'epic' | 'entry'
export type CrossProject = { id: string; name: string }
/** `id` = task / epic / entry id (null for a doc); `path` = the file, relative to the project root. */
export type CrossHit = { kind: CrossKind; id: string | null; path: string; title: string; snippet: string; score: number }
export type CrossResult = CrossHit & { project: CrossProject }
export type CrossGroup = { project: CrossProject; results: CrossResult[] }

export const PER_PROJECT = 10
export const TOTAL = 50

/** Tasks / epics by title + id, on the docs' scale: per unique query token +3 in the title, +2 when it is the id. */
export function rankItems(items: readonly Omit<CrossHit, 'score'>[], query: string, tokenize: (s: string) => string[]): CrossHit[] {
  const q = [...new Set(tokenize(query))]
  const out: CrossHit[] = []
  for (const it of items) {
    const title = new Set(tokenize(it.title))
    const id = it.id?.toLowerCase()
    let score = 0
    for (const t of q) {
      if (title.has(t)) score += 3
      if (t === id) score += 2
    }
    if (score) out.push({ ...it, score })
  }
  return out
}

const KIND_ORDER: Record<CrossKind, number> = { doc: 0, entry: 1, epic: 2, task: 3 }
const byScore = (a: CrossHit, b: CrossHit) => b.score - a.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.path.localeCompare(b.path)

/**
 * Top `perProject` per project, then the best `total` overall, grouped by project; the project with the best hit
 * comes first (a tie keeps the order given). Projects with no hit are left out.
 */
export function mergeResults(perProject: readonly { project: CrossProject; hits: readonly CrossHit[] }[], opts: { perProject?: number; total?: number } = {}): CrossGroup[] {
  const each = opts.perProject ?? PER_PROJECT
  const all = perProject.flatMap(({ project, hits }) => [...hits].sort(byScore).slice(0, each).map(h => ({ ...h, project })))
  const kept = all.sort(byScore).slice(0, opts.total ?? TOTAL) // Array#sort is stable: equal hits keep project order
  const groups = new Map<string, CrossGroup>()
  for (const r of kept) {
    const g = groups.get(r.project.id) ?? { project: r.project, results: [] }
    g.results.push(r)
    groups.set(r.project.id, g)
  }
  return [...groups.values()]
}

/** Agent text: every line starts with `[<project id>]`, so an agent knows which repo to open. */
export function formatCrossSearch(query: string, groups: readonly CrossGroup[]): string {
  const n = groups.reduce((s, g) => s + g.results.length, 0)
  if (!n) return `No results for "${query}" in this project's groups`
  const lines = [`🔍 "${query}" — ${n} result(s) in ${groups.length} project(s)\n`]
  for (const g of groups) {
    for (const r of g.results) {
      lines.push(`[${g.project.id}] ${r.kind} ${r.id ? `${r.id} · ` : ''}**${r.title}** — ${r.path}`)
      if (r.snippet) lines.push(`[${g.project.id}]   ${r.snippet}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** The page a result opens in its own project (T551); the caller adds `?project=`. */
export function hitHref(r: Pick<CrossHit, 'kind' | 'id' | 'path'>): string {
  const id = encodeURIComponent(r.id ?? '')
  if (r.kind === 'task') return `/board?task=${id}`
  if (r.kind === 'epic') return `/roadmap?item=${id}`
  if (r.kind === 'entry') return `/memory?entry=${id}`
  return `/docs?doc=${encodeURIComponent(r.path)}`
}

/** A doc hit's snippet for people: no `L12:` prefix, no block markers (`# `, `> `, `- `, `| `), links keep their text. */
export function snippetText(snippet: string): string {
  return snippet
    .replace(/^L\d+:\s*/, '')
    .replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|\|\s*)+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/\s*\|\s*$/, '')
    .replace(/\s*\|\s*/g, ' · ')
    .trim()
}

/** `text` split on the query's words (case-insensitive, 2+ letters), so the matches can be marked. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const words = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length >= 2))]
  if (!words.length || !text) return text ? [{ text, hit: false }] : []
  const re = new RegExp(`(${words.sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu')
  return text.split(re).map((part, i) => ({ text: part, hit: i % 2 === 1 })).filter((p) => p.text)
}
