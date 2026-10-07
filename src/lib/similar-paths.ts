// R087: "did you mean" for a doc path that doesn't exist. Pure; the tokenizer is passed in
// (core.ts passes recall's `tokenize`) because pure libs never value-import each other.

const PART_MIN = 3

/** True when two tokens are the same word give or take a typo: equal, one contains the other, or a shared 4+ prefix. */
function near(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= PART_MIN && b.length >= PART_MIN && (a.includes(b) || b.includes(a))) return true
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i >= 4
}

/**
 * Up to `n` of `paths` that look like `query`: +2 per query token near a basename token, +1 near a folder token.
 * Ties → shorter path, then alphabetical. Nothing in common → [].
 */
export function similarPaths(query: string, paths: string[], tokenize: (s: string) => string[], n = 5): string[] {
  const words = [...new Set(tokenize(query.replace(/\.md$/i, '')))]
  if (!words.length) return []
  const scored = paths.map((p) => {
    const parts = p.replace(/\.md$/i, '').split('/')
    const base = tokenize(parts.pop() ?? '')
    const dirs = tokenize(parts.join(' '))
    const score = words.reduce((s, w) => s + (base.some((t) => near(w, t)) ? 2 : dirs.some((t) => near(w, t)) ? 1 : 0), 0)
    return { p, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.p.length - b.p.length || a.p.localeCompare(b.p))
    .slice(0, n)
    .map((s) => s.p)
}
