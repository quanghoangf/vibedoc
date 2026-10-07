// Recently opened items per browser (T511): the sidebar lists them under their page. Ids only, never content, kept
// in the `vibedoc-recent` cookie (no localStorage, CLAUDE.md). Pure: the component reads / writes document.cookie.

export const RECENT_COOKIE = 'vibedoc-recent'
/** Kept per kind; the sidebar shows fewer. */
export const RECENT_CAP = 5

/** task = opened on the board, test = opened in Test review, epic = a roadmap item, doc = a .md path, entry = E012. */
export const RECENT_KINDS = ['task', 'test', 'epic', 'doc', 'entry'] as const
export type RecentKind = typeof RECENT_KINDS[number]
/** Newest first. */
export type Recent = Record<RecentKind, string[]>

const VALID: Record<RecentKind, (id: string) => boolean> = {
  task: (id) => /^T\d+$/.test(id),
  test: (id) => /^T\d+$/.test(id),
  epic: (id) => /^R\d+$/.test(id),
  // a project-relative .md path; long paths would eat the 4 KB cookie
  doc: (id) => id.endsWith('.md') && id.length <= 200 && !id.startsWith('/') && !id.split('/').includes('..'),
  entry: (id) => /^E\d+$/.test(id),
}

export function emptyRecent(): Recent {
  return { task: [], test: [], epic: [], doc: [], entry: [] }
}

/** The cookie value (already URI-decoded) → refs; anything malformed is dropped, never thrown. */
export function parseRecent(value: string | null | undefined): Recent {
  const out = emptyRecent()
  if (!value) return out
  let raw: unknown
  try {
    raw = JSON.parse(value)
  } catch {
    return out
  }
  if (!raw || typeof raw !== 'object') return out
  for (const kind of RECENT_KINDS) {
    const list = (raw as Record<string, unknown>)[kind]
    if (!Array.isArray(list)) continue
    out[kind] = [...new Set(list.filter((id): id is string => typeof id === 'string' && VALID[kind](id)))].slice(0, RECENT_CAP)
  }
  return out
}

/** `id` moved to the front of its kind, capped. Same object back when nothing changes (no cookie write). */
export function pushRecent(recent: Recent, kind: RecentKind, id: string): Recent {
  if (!VALID[kind](id) || recent[kind][0] === id) return recent
  return { ...recent, [kind]: [id, ...recent[kind].filter((x) => x !== id)].slice(0, RECENT_CAP) }
}

/** A `document.cookie` assignment; empty kinds are left out. */
export function recentCookie(recent: Recent): string {
  const kept = Object.fromEntries(RECENT_KINDS.filter((k) => recent[k].length).map((k) => [k, recent[k]]))
  return `${RECENT_COOKIE}=${encodeURIComponent(JSON.stringify(kept))}; path=/; max-age=31536000; samesite=lax`
}
