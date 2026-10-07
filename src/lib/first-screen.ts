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

/** Per-browser cookie with the last (app) page used (R082): `/` reopens it on a set-up project. */
export const LAST_PAGE_COOKIE = 'vibedoc-last'

/** Pages `/` may reopen. Never /start or /setup: a set-up project skips the welcome and the wizard is on request only. */
const REOPENABLE = ['/board', '/roadmap', '/docs', '/graph', '/chat', '/memory', '/activity', '/manual-tests', '/explorer', '/settings', '/getting-started']

/** The page `/` opens for a set-up project: the remembered one when it is a known page, else the board. */
export function lastPageTarget(cookie: string | undefined | null): string {
  return cookie && REOPENABLE.includes(cookie) ? cookie : '/board'
}

/** The cookie to remember `pathname`, or null when it isn't a page to reopen (its top-level route is kept). */
export function lastPageCookie(pathname: string): string | null {
  const top = '/' + (pathname.split('/')[1] ?? '')
  return REOPENABLE.includes(top) ? `${LAST_PAGE_COOKIE}=${top}; path=/; max-age=31536000; samesite=lax` : null
}
