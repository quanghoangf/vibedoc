// What VibeDoc opens first (R082): pure, no fs. The root page (src/app/page.tsx) feeds it from core.

/** Markdown that says nothing about the product: licence and process boilerplate. */
const BOILERPLATE = /^(license|licence|changelog|contributing|code_of_conduct|security)(\.[\w-]+)?\.md$/i

/**
 * Docs a roadmap could be planned from: any .md outside VibeDoc's own folders (plans/, memory/) and dot-folders,
 * minus boilerplate. README, CLAUDE.md, AGENTS.md and docs/** count.
 */
export function hasProjectDocs(paths: string[]): boolean {
  return paths.some((p) => {
    const parts = p.split('/')
    if (parts.some((s) => s.startsWith('.') || s === 'node_modules')) return false
    if (parts[0] === 'plans' || parts[0] === 'memory') return false
    return !BOILERPLATE.test(parts[parts.length - 1])
  })
}

/** A project with any task or roadmap item is set up and skips the welcome; the demo always opens the board. */
export function firstScreen(p: { tasks: number; roadmapItems: number; demo?: boolean }): 'board' | 'start' {
  return p.demo || p.tasks > 0 || p.roadmapItems > 0 ? 'board' : 'start'
}

/** Which welcome: plan from the docs, or plan from scratch with the agent. */
export function welcomeKind(docPaths: string[]): 'docs' | 'empty' {
  return hasProjectDocs(docPaths) ? 'docs' : 'empty'
}

/**
 * Per-browser cookie with the last (app) page used per project (R082, per project since R099):
 * `<id>:<path>` pairs joined by `|`, newest first, at most MAX_LAST_PAGES. A pre-R099 bare `/roadmap` is project ''.
 */
export const LAST_PAGE_COOKIE = 'vibedoc-last'
export const MAX_LAST_PAGES = 20

/** Pages `/` may reopen. Never /start or /setup: a set-up project skips the welcome and the wizard is on request only. */
const REOPENABLE = ['/board', '/roadmap', '/docs', '/graph', '/chat', '/memory', '/activity', '/manual-tests', '/explorer', '/settings', '/getting-started']

/** Cookie value → [project id, page] pairs, newest first; unknown pages dropped. */
export function parseLastPages(cookie: string | undefined | null): [string, string][] {
  const out: [string, string][] = []
  for (const part of (cookie ?? '').split('|')) {
    const at = part.lastIndexOf(':')
    const id = at < 0 ? '' : part.slice(0, at)
    const page = at < 0 ? part : part.slice(at + 1)
    if (REOPENABLE.includes(page) && !out.some(([i]) => i === id)) out.push([id, page])
  }
  return out
}

/** The page `/` opens for a set-up project: the one remembered for this project when it is a known page, else the board. */
export function lastPageTarget(cookie: string | undefined | null, projectId = ''): string {
  return parseLastPages(cookie).find(([id]) => id === projectId)?.[1] ?? '/board'
}

/** The cookie to remember `pathname` for `projectId` (its top-level route), or null when it isn't a page to reopen. */
export function lastPageCookie(pathname: string, cookie?: string | null, projectId = ''): string | null {
  const top = '/' + (pathname.split('/')[1] ?? '')
  if (!REOPENABLE.includes(top)) return null
  const pairs = [[projectId, top], ...parseLastPages(cookie).filter(([id]) => id !== projectId)].slice(0, MAX_LAST_PAGES)
  const value = pairs.map(([id, page]) => id ? `${id}:${page}` : page).join('|')
  return `${LAST_PAGE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
}
