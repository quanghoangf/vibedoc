// Pure ranked doc search (R088, no fs). Self-check: node src/lib/doc-search.check.mts
// Whole files are ranked by where the query words sit: title > heading > body. Tokenizing is recall.ts's `tokenize`,
// passed in by core (pure libs never import values from each other).

export type SearchResult = { file: string; hits: { line: number; text: string }[]; totalHits: number }
export type SearchFile = { path: string; raw: string }

const MAX_HITS = 4
const SNIPPET = 120

/** Per unique query token: +3 in the title (H1, else the file name), +2 in any heading, +1 in the body. Score 0 dropped; ties → path. */
export function rankDocs(files: readonly SearchFile[], query: string, tokenize: (s: string) => string[], limit = 20): SearchResult[] {
  const q = [...new Set(tokenize(query))]
  if (!q.length) return substringSearch(files, query, limit)
  const scored: (SearchResult & { score: number })[] = []
  for (const f of files) {
    const lines = f.raw.split('\n')
    let inFence = false
    let title = ''
    const headings: string[] = []
    const body: string[] = []
    for (const l of lines) {
      if (/^\s*```/.test(l)) { inFence = !inFence; body.push(l); continue }
      const h = inFence ? null : /^(#{1,6})\s+(.+)$/.exec(l)
      if (h && h[1].length === 1 && !title) title = h[2]
      else if (h) headings.push(h[2])
      else body.push(l)
    }
    const titleT = new Set(tokenize(title || (f.path.split('/').pop() ?? f.path).replace(/\.md$/i, '')))
    const headT = new Set(tokenize(headings.join('\n')))
    const bodyT = new Set(tokenize(body.join('\n')))
    let score = 0
    for (const t of q) {
      if (titleT.has(t)) score += 3
      if (headT.has(t)) score += 2
      if (bodyT.has(t)) score += 1
    }
    if (!score) continue
    const qs = new Set(q)
    const hits = lines.map((text, i) => ({ line: i + 1, text: text.trim().slice(0, SNIPPET) }))
      .filter(h => tokenize(h.text).some(t => qs.has(t)))
    scored.push({ file: f.path, hits: hits.slice(0, MAX_HITS), totalHits: hits.length, score })
  }
  scored.sort((a, b) => b.score - a.score || b.totalHits - a.totalHits || a.file.localeCompare(b.file))
  return scored.slice(0, limit).map(({ score: _, ...r }) => r)
}

/** The old line-substring match, for a query that is only stopwords ("a", "the"). */
function substringSearch(files: readonly SearchFile[], query: string, limit: number): SearchResult[] {
  const ql = query.trim().toLowerCase()
  if (!ql) return []
  const out: SearchResult[] = []
  for (const f of files) {
    const hits = f.raw.split('\n').map((text, i) => ({ line: i + 1, text: text.trim().slice(0, SNIPPET) }))
      .filter(h => h.text.toLowerCase().includes(ql))
    if (hits.length) out.push({ file: f.path, hits: hits.slice(0, MAX_HITS), totalHits: hits.length })
  }
  return out.sort((a, b) => b.totalHits - a.totalHits || a.file.localeCompare(b.file)).slice(0, limit)
}
