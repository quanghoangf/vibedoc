// The sidebar's page children (T511): per page, at most MAX_NEEDS items that need your action there. The page
// itself lists the rest; the sidebar no longer mirrors pages (no "Viewed" history, no "+N more").
// Pure, no React, no fs. Rules are the ones the pages already use, passed in (`needsYou`) or precomputed
// (roadmap drift, doc lint, memory flags): nothing new is decided here, only picked, ordered and capped.

/** Needs-action rows per page; the rest are on the page. */
export const MAX_NEEDS = 3

export type SidebarPage = '/board' | '/manual-tests' | '/roadmap' | '/docs' | '/memory'
export const CHILD_PAGES: SidebarPage[] = ['/board', '/manual-tests', '/roadmap', '/docs', '/memory']

/** Why a child is listed; the component words it (`shell.hint.<hint>`). */
export type ChildHint =
  | 'review' | 'blocked' | 'failed' | 'unverified' | 'checks'
  | 'overdue' | 'at-risk' | 'drift'
  | 'lint' | 'outdated'
  | 'cleanup'

export interface SidebarChild {
  /** unique within the page */
  key: string
  kind: 'task' | 'epic' | 'doc' | 'entry' | 'cleanup'
  /** T216, R066, E012, the doc path; '' for cleanup */
  id: string
  /** user content (title, summary, doc name); '' when the id says it all */
  label: string
  reason: 'needs-action'
  hint: ChildHint
  /** count for lint / checks / cleanup */
  n?: number
  tone: 'danger' | 'warn' | 'review' | 'muted'
  href: string
}

export interface TaskLite {
  id: string
  title: string
  status: string
  manualTests: { untested: number; autoRun: { result: 'passed' | 'failed'; unverified?: number } | null } | null
  lastRun: { status: 'passed' | 'failed' } | null
}

export interface SidebarInput {
  tasks: TaskLite[]
  /** test-review's rule (countNeedsYou for one task), injected so there is one definition */
  needsYou: (t: TaskLite) => boolean
  /** null while the roadmap / lint / memory haven't loaded: those pages then list nothing yet */
  epics: { id: string; title: string }[] | null
  drift: { id: string; kind: string }[]
  docs: { path: string; name: string }[] | null
  /** per doc: lint errors and "may be outdated" refs (R092) */
  lint: { path: string; errors: number; outdated: number }[]
  /** memory cleanup flags that want a decision (severity warn) */
  cleanupFlags: number
}

const enc = encodeURIComponent

const cap = (needs: SidebarChild[]) => needs.slice(0, MAX_NEEDS)

function testHint(t: TaskLite): { hint: ChildHint; tone: SidebarChild['tone']; n?: number } {
  const result = t.lastRun?.status ?? t.manualTests?.autoRun?.result
  if (result === 'failed') return { hint: 'failed', tone: 'danger' }
  if ((t.manualTests?.autoRun?.unverified ?? 0) > 0) return { hint: 'unverified', tone: 'warn' }
  if (t.status === 'review') return { hint: 'review', tone: 'review' }
  return { hint: 'checks', tone: 'warn', n: t.manualTests?.untested ?? 0 }
}

const TEST_ORDER: ChildHint[] = ['failed', 'unverified', 'review', 'checks']
const DRIFT_ORDER = ['overdue', 'at-risk']

export function sidebarChildren(input: SidebarInput): Record<SidebarPage, SidebarChild[]> {
  // Board: the task is waiting on you (review) or stuck (blocked)
  const boardNeeds = (['review', 'blocked'] as const).flatMap((status) => input.tasks.filter((t) => t.status === status).map((t): SidebarChild => ({
    key: `n:${t.id}`, kind: 'task', id: t.id, label: t.title, reason: 'needs-action', hint: status, tone: status === 'blocked' ? 'danger' : 'review', href: `/board?task=${t.id}`,
  })))

  // Manual tests: the Needs you tab, failed first
  const testNeeds = input.tasks.filter(input.needsYou)
    .map((t): SidebarChild => ({ key: `n:${t.id}`, kind: 'task', id: t.id, label: t.title, reason: 'needs-action', ...testHint(t), href: `/manual-tests?task=${t.id}` }))
    .sort((a, b) => TEST_ORDER.indexOf(a.hint) - TEST_ORDER.indexOf(b.hint))

  // Roadmap: one row per drifting epic, its worst kind
  const epics = input.epics && new Map(input.epics.map((e) => [e.id, e]))
  const worst = new Map<string, ChildHint>()
  for (const d of input.drift) {
    const hint: ChildHint = d.kind === 'overdue' ? 'overdue' : d.kind === 'at-risk' ? 'at-risk' : 'drift'
    const cur = worst.get(d.id)
    if (!cur || rank(hint) < rank(cur)) worst.set(d.id, hint)
  }
  const roadmapNeeds = [...worst].flatMap(([id, hint]): SidebarChild[] => {
    const e = epics?.get(id)
    return e ? [{ key: `n:${id}`, kind: 'epic', id, label: e.title, reason: 'needs-action', hint, tone: 'warn', href: `/roadmap?item=${id}` }] : []
  }).sort((a, b) => rank(a.hint) - rank(b.hint))

  // Docs: lint errors, then docs that may be outdated
  const docs = input.docs && new Map(input.docs.map((d) => [d.path, d]))
  const docName = (path: string) => docs?.get(path)?.name ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path
  const docNeeds = [
    ...input.lint.filter((l) => l.errors > 0).sort((a, b) => b.errors - a.errors)
      .map((l): SidebarChild => ({ key: `n:${l.path}`, kind: 'doc', id: l.path, label: docName(l.path), reason: 'needs-action', hint: 'lint', n: l.errors, tone: 'danger', href: `/docs?doc=${enc(l.path)}` })),
    ...input.lint.filter((l) => l.errors === 0 && l.outdated > 0)
      .map((l): SidebarChild => ({ key: `n:${l.path}`, kind: 'doc', id: l.path, label: docName(l.path), reason: 'needs-action', hint: 'outdated', tone: 'warn', href: `/docs?doc=${enc(l.path)}` })),
  ]

  // Memory: one Cleanup row (the panel decides per flag)
  const memoryNeeds: SidebarChild[] = input.cleanupFlags > 0
    ? [{ key: 'cleanup', kind: 'cleanup', id: '', label: '', reason: 'needs-action', hint: 'cleanup', n: input.cleanupFlags, tone: 'warn', href: '/memory?cleanup=1' }]
    : []

  return {
    '/board': cap(boardNeeds),
    '/manual-tests': cap(testNeeds),
    '/roadmap': cap(roadmapNeeds),
    '/docs': cap(docNeeds),
    '/memory': cap(memoryNeeds),
  }
}

function rank(h: ChildHint): number {
  const i = DRIFT_ORDER.indexOf(h)
  return i === -1 ? DRIFT_ORDER.length : i
}

// ─── Open / closed per page ─────────────────────────────────────────────────
// Only explicit choices are kept; a page you never toggled stays collapsed (its row shows a needs-you dot instead),
// so every page link fits above the fold.

export const SIDEBAR_COOKIE = 'vibedoc-sidebar'
export type Disclosure = Partial<Record<SidebarPage, boolean>>

/** `board:1,docs:0` → { "/board": true, "/docs": false }; unknown pages and junk are dropped. */
export function parseDisclosure(value: string | null | undefined): Disclosure {
  const out: Disclosure = {}
  for (const part of (value ?? '').split(',')) {
    const [name, v] = part.split(':')
    const page = `/${name}` as SidebarPage
    if (CHILD_PAGES.includes(page) && (v === '1' || v === '0')) out[page] = v === '1'
  }
  return out
}

export function disclosureCookie(d: Disclosure): string {
  const value = CHILD_PAGES.filter((p) => d[p] !== undefined).map((p) => `${p.slice(1)}:${d[p] ? 1 : 0}`).join(',')
  return `${SIDEBAR_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
}

export function isExpanded(page: SidebarPage, d: Disclosure): boolean {
  return d[page] ?? false
}
