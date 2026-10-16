/**
 * Portfolio overview (R106, pure): how each hub project is doing, sorted by attention needed.
 * Core computes `roadmapHealth` and reads the activity log per project; this only counts, rolls up groups and sorts.
 * No fs, no value imports from other libs. Self-check: node src/lib/portfolio.check.mts
 */

/** An epic named on a row; `project` is the hub id of the repo it lives in (a group row mixes repos). */
export interface EpicRef { id: string; title: string; project: string }

export interface PortfolioInput {
  id: string
  name: string
  items: { id: string; title: string; parent: string | null; status: string }[]
  /** `roadmapHealth(items, …).drift`, only `id` + `kind` are read */
  drift: { id: string; kind: string }[]
  tasks: { status: string }[]
  events: { timestamp: string; type: string; actor: 'ai' | 'human'; taskId?: string; taskStatus?: string }[]
}

export interface ProjectStats {
  kind: 'project'
  id: string
  name: string
  /** Epics (items with a parent) done / all */
  epics: { done: number; total: number }
  atRisk: EpicRef[]
  overdue: EpicRef[]
  blocked: number
  /** Distinct tasks moved to done in the last 7 local days, by who moved them */
  doneThisWeek: { ai: number; human: number }
  /** Newest activity event's ISO time, null when the log is empty */
  lastActivity: string | null
  /** at-risk × 3 + overdue × 2 + blocked tasks */
  attention: number
}

export interface GroupStats extends Omit<ProjectStats, 'kind' | 'id'> {
  kind: 'group'
  slug: string
  members: ProjectStats[]
}

export type PortfolioRow = ProjectStats | GroupStats

/** Local calendar day of an instant (the activity log stores ISO instants). */
function localDay(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** `since` = the first local day of the week window ("YYYY-MM-DD", today − 6), compared as strings. */
export function projectStats(p: PortfolioInput, since: string): ProjectStats {
  const epics = p.items.filter(i => i.parent !== null)
  const byId = new Map(epics.map(i => [i.id, i]))
  const refs = (kind: string): EpicRef[] => [...new Set(p.drift.filter(d => d.kind === kind && byId.has(d.id)).map(d => d.id))]
    .map(id => ({ id, title: byId.get(id)?.title ?? id, project: p.id }))
  const atRisk = refs('at-risk')
  const overdue = refs('overdue')
  const blocked = p.tasks.filter(t => t.status === 'blocked').length
  const done = { ai: new Set<string>(), human: new Set<string>() }
  let lastActivity: string | null = null
  for (const e of p.events) {
    if (!lastActivity || e.timestamp > lastActivity) lastActivity = e.timestamp
    if (e.type === 'task_updated' && e.taskStatus === 'done' && e.taskId && localDay(e.timestamp) >= since) done[e.actor].add(e.taskId)
  }
  return {
    kind: 'project', id: p.id, name: p.name,
    epics: { done: epics.filter(i => i.status === 'done').length, total: epics.length },
    atRisk, overdue, blocked,
    doneThisWeek: { ai: done.ai.size, human: done.human.size },
    lastActivity,
    attention: atRisk.length * 3 + overdue.length * 2 + blocked,
  }
}

/** Most attention first; ties by newest activity (none last), then name. */
export function attentionSort<T extends Pick<ProjectStats, 'attention' | 'lastActivity' | 'name'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    b.attention - a.attention ||
    (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '') ||
    a.name.localeCompare(b.name))
}

/**
 * One row per group (its members summed, nested and sorted) plus a row per project in no group, all attention-sorted.
 * A project in two groups shows under both.
 */
export function groupRollup(projects: ProjectStats[], groups: { slug: string; name: string; members: { id: string }[] }[]): PortfolioRow[] {
  const byId = new Map(projects.map(p => [p.id, p]))
  const grouped = new Set<string>()
  const rows: PortfolioRow[] = []
  for (const g of groups) {
    const members = attentionSort(g.members.map(m => byId.get(m.id)).filter((m): m is ProjectStats => !!m))
    if (!members.length) continue
    members.forEach(m => grouped.add(m.id))
    const last = members.map(m => m.lastActivity).filter((t): t is string => !!t).sort().at(-1) ?? null
    rows.push({
      kind: 'group', slug: g.slug, name: g.name, members,
      epics: { done: sum(members, m => m.epics.done), total: sum(members, m => m.epics.total) },
      atRisk: members.flatMap(m => m.atRisk),
      overdue: members.flatMap(m => m.overdue),
      blocked: sum(members, m => m.blocked),
      doneThisWeek: { ai: sum(members, m => m.doneThisWeek.ai), human: sum(members, m => m.doneThisWeek.human) },
      lastActivity: last,
      attention: sum(members, m => m.attention),
    })
  }
  rows.push(...projects.filter(p => !grouped.has(p.id)))
  return attentionSort(rows)
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0)
