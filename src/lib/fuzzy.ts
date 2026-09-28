// Subsequence fuzzy match for the Cmd+P file finder (VS Code-style, much simpler).
// Every query char must appear in order. Consecutive runs, word starts and hits
// in the file name (not the folder) score higher.

const BOUNDARY = /[/\-_. ]/

/**
 * Score `query` against `path`; null when not every query char is found in order.
 * Greedy from the leftmost hit would let "hld" start in "arcHitecture" and miss "HLD.md",
 * so try every position of the first char and keep the best.
 */
export function fuzzyScore(query: string, path: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, "")
  if (!q) return 0
  const p = path.toLowerCase()
  let best: number | null = null
  for (let start = p.indexOf(q[0]); start !== -1; start = p.indexOf(q[0], start + 1)) {
    const s = greedyScore(q, p, start)
    if (s !== null && (best === null || s > best)) best = s
  }
  return best
}

// ponytail: O(path × first-char hits); fine for a few thousand docs, swap for DP if it lags.
function greedyScore(q: string, p: string, start: number): number | null {
  const nameStart = p.lastIndexOf("/") + 1
  let score = 0
  let qi = 0
  let prev = -2
  for (let i = start; i < p.length && qi < q.length; i++) {
    if (p[i] !== q[qi]) continue
    score += 1
    if (i === prev + 1) score += 5
    if (i === 0 || BOUNDARY.test(p[i - 1])) score += 8
    if (i >= nameStart) score += 3
    prev = i
    qi++
  }
  return qi === q.length ? score : null
}

/** Paths matching `query`, best first; ties go to the shorter path. */
export function fuzzyFilter<T>(query: string, items: T[], getPath: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, path: getPath(item), score: fuzzyScore(query, getPath(item)) }))
    .filter((r): r is { item: T; path: string; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .map((r) => r.item)
}
