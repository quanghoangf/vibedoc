// Pure memory health checks (R051, no fs): memory that contradicts the board, or names items that don't exist.
// Self-check: node src/lib/memory-health.check.mts

export type HealthKind = 'contradiction' | 'dangling-ref' | 'duplicate' | 'stale'
export type HealthFlag = {
  id: string            // stable key, e.g. "contradiction:working-on:T055", used for dismissing
  kind: HealthKind
  severity: 'warn' | 'info'
  message: string       // one line, shown as is in the UI and MCP output
  refs: string[]        // item ids involved (T055, E012, …)
  suggestion?: { action: 'merge' | 'delete'; ids: string[] }
}
export type BoardStatus = { id: string; status: string }   // tasks + roadmap items
/** Item ids mentioned in a text. core.ts passes memory-graph's extractRefs (pure libs don't import values from each other). */
export type RefsOf = (text: string) => string[]

type Section = 'working-on' | 'up-next' | 'just-completed'
// MEMORY.md headings written by updateMemory(): "## Working on now", "## Up next", "## Just completed"
const SECTION_RE: [Section, RegExp][] = [
  ['working-on', /^working on\b/i],
  ['up-next', /^up next\b/i],
  ['just-completed', /^just completed\b/i],
]
const CLOSED = new Set(['done', 'cancelled'])
const isBoardId = (id: string) => /^[TR]\d/.test(id)

/** `## Heading` → body, in file order. Text before the first `##` is keyed ''. */
export function splitSections(markdown: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [{ heading: '', body: '' }]
  for (const line of markdown.split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line)
    if (h) out.push({ heading: h[1], body: '' })
    else out[out.length - 1].body += line + '\n'
  }
  return out
}

const sectionOf = (heading: string): Section | undefined => SECTION_RE.find(([, re]) => re.test(heading))?.[0]

export function findContradictions(
  handoff: string,
  entries: { id: string; body: string; summary: string }[],
  board: BoardStatus[],
  refsOf: RefsOf,
): HealthFlag[] {
  const status = new Map(board.map(b => [b.id, b.status]))
  const flags = new Map<string, HealthFlag>()
  const add = (f: HealthFlag) => { if (!flags.has(f.id)) flags.set(f.id, f) }
  const dangling = (source: string, who: string, text: string) => {
    for (const id of refsOf(text).filter(isBoardId)) {
      if (!status.has(id)) add({ id: `dangling-ref:${source}:${id}`, kind: 'dangling-ref', severity: 'info', message: `${who} mentions ${id}, which doesn't exist`, refs: [id] })
    }
  }

  for (const { heading, body } of splitSections(handoff)) {
    dangling('handoff', 'Handoff', body)
    const section = sectionOf(heading)
    if (!section) continue
    for (const id of refsOf(body).filter(isBoardId)) {
      const s = status.get(id)
      if (s === undefined) continue
      if (section === 'just-completed') {
        // epics named here are usually context ("T117 of R051"), so only tasks must be done
        if (id.startsWith('T') && s !== 'done') {
          add({ id: `contradiction:${section}:${id}`, kind: 'contradiction', severity: 'warn', message: `Handoff says ${id} is done, but it is ${s}`, refs: [id] })
        }
      } else if (CLOSED.has(s)) {
        const says = section === 'working-on' ? 'in progress' : 'up next'
        add({ id: `contradiction:${section}:${id}`, kind: 'contradiction', severity: 'warn', message: `Handoff says ${id} is ${says}, but it is ${s}`, refs: [id] })
      }
    }
  }
  // done tasks in entries are fine (long-lived facts); only missing ids are flagged
  for (const e of entries) dangling(e.id, e.id, `${e.summary}\n${e.body}`)

  return [...flags.values()].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'warn' ? -1 : 1) ||
    a.refs[0].localeCompare(b.refs[0], 'en', { numeric: true }) ||
    a.id.localeCompare(b.id, 'en', { numeric: true }))
}

export const MAX_SESSION_WARNINGS = 5

/** The block vibedoc_read_memory shows under the handoff: warn flags (max 5), else one info line, else ''. */
export function formatHealthWarnings(flags: HealthFlag[]): string {
  const warns = flags.filter(f => f.severity === 'warn')
  if (!warns.length) {
    const n = flags.length
    return n ? `ℹ ${n} memory cleanup ${n === 1 ? 'suggestion' : 'suggestions'} on /memory` : ''
  }
  const more = warns.length - MAX_SESSION_WARNINGS
  return ['## ⚠ Memory warnings', ...warns.slice(0, MAX_SESSION_WARNINGS).map(f => `- ⚠ ${f.message}`),
    ...(more > 0 ? [`…and ${more} more on /memory`] : [])].join('\n')
}
