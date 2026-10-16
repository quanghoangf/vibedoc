// Self-check for src/lib/portfolio.ts: `node src/lib/portfolio.check.mts`
import assert from 'node:assert/strict'
import type { RoadmapItem } from './core'
import { roadmapHealth, type TaskInfo } from './roadmap-health.ts'
import { attentionSort, groupRollup, projectStats, type PortfolioInput } from './portfolio.ts'

const TODAY = '2026-10-16'
const SINCE = '2026-10-10'
const item = (id: string, parent: string | null, status: RoadmapItem['status'], tasks: string[] = [], due: string | null = null): RoadmapItem =>
  ({ id, title: `Epic ${id}`, parent, status, order: 10, tasks, due, owner: null, priority: null, specs: [], scenarios: [], specMerged: null, specChanges: [], body: '', file: `${id}.md` })
// a local-noon instant on a calendar day, so the day survives any timezone
const at = (day: string) => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12).toISOString()

function input(id: string, items: RoadmapItem[], tasks: Record<string, TaskInfo>, events: PortfolioInput['events'] = []): PortfolioInput {
  return { id, name: id, items, drift: roadmapHealth(items, tasks, TODAY).drift, tasks: Object.values(tasks), events }
}

// S1: one project with an at-risk epic (a blocked task), two without → it sorts first, naming the epic
const risky = input('risky', [item('H', null, 'in-progress'), item('R1', 'H', 'in-progress', ['T1', 'T2'])], { T1: { status: 'blocked', due: null }, T2: { status: 'todo', due: null } })
const calm = input('calm', [item('H', null, 'done'), item('R1', 'H', 'done', ['T1'])], { T1: { status: 'done', due: null } }, [
  { timestamp: at('2026-10-15'), type: 'task_updated', actor: 'ai', taskId: 'T1', taskStatus: 'done' },
])
const quiet = input('quiet', [item('H', null, 'planned'), item('R1', 'H', 'planned', ['T1'])], { T1: { status: 'todo', due: null } })
const stats = [calm, quiet, risky].map(p => projectStats(p, SINCE))
const sorted = attentionSort(stats)
assert.equal(sorted[0].id, 'risky')
assert.deepEqual(sorted[0].atRisk, [{ id: 'R1', title: 'Epic R1', project: 'risky' }])
assert.equal(sorted[0].blocked, 1)
assert.equal(sorted[0].attention, 3 + 1)
// ties by newest activity: calm has an event, quiet none
assert.deepEqual(sorted.map(s => s.id), ['risky', 'calm', 'quiet'])
assert.deepEqual(stats[0].epics, { done: 1, total: 1 }) // horizons aren't epics

// overdue epics count × 2
const late = projectStats(input('late', [item('H', null, 'in-progress'), item('R2', 'H', 'in-progress', ['T1'], '2026-10-01')], { T1: { status: 'in-progress', due: null } }), SINCE)
assert.deepEqual(late.overdue.map(e => e.id), ['R2'])
assert.equal(late.attention, 2)

// done this week: ai and human apart, distinct tasks, only the last 7 local days, only moves to done
const week = projectStats(input('week', [], {}, [
  { timestamp: at('2026-10-16'), type: 'task_updated', actor: 'ai', taskId: 'T1', taskStatus: 'done' },
  { timestamp: at('2026-10-14'), type: 'task_updated', actor: 'ai', taskId: 'T1', taskStatus: 'done' },
  { timestamp: at('2026-10-12'), type: 'task_updated', actor: 'ai', taskId: 'T2', taskStatus: 'done' },
  { timestamp: at('2026-10-10'), type: 'task_updated', actor: 'human', taskId: 'T3', taskStatus: 'done' },
  { timestamp: at('2026-10-09'), type: 'task_updated', actor: 'human', taskId: 'T4', taskStatus: 'done' },
  { timestamp: at('2026-10-13'), type: 'task_updated', actor: 'human', taskId: 'T5', taskStatus: 'in-progress' },
  { timestamp: at('2026-10-13'), type: 'doc_updated', actor: 'human' },
]), SINCE)
assert.deepEqual(week.doneThisWeek, { ai: 2, human: 1 })
assert.equal(week.lastActivity, at('2026-10-16'))
assert.equal(projectStats(input('empty', [], {}), SINCE).lastActivity, null)

// groups: members summed and nested; ungrouped projects stay rows; all attention-sorted
const rows = groupRollup(stats, [{ slug: 'shop', name: 'Shop', members: [{ id: 'calm' }, { id: 'quiet' }] }, { slug: 'gone', name: 'Gone', members: [{ id: 'nope' }] }])
assert.deepEqual(rows.map(r => r.kind === 'group' ? `g:${r.slug}` : r.id), ['risky', 'g:shop'])
const shop = rows[1]
assert.ok(shop.kind === 'group')
assert.deepEqual(shop.members.map(m => m.id), ['calm', 'quiet'])
assert.deepEqual(shop.epics, { done: 1, total: 2 })
assert.deepEqual(shop.doneThisWeek, { ai: 1, human: 0 })
assert.equal(shop.lastActivity, at('2026-10-15'))
// an at-risk member lifts its group, and the chip keeps the member's repo
const g2 = groupRollup(stats, [{ slug: 'all', name: 'All', members: stats.map(s => ({ id: s.id })) }])
assert.equal(g2.length, 1)
assert.deepEqual(g2[0].atRisk, [{ id: 'R1', title: 'Epic R1', project: 'risky' }])

console.log('portfolio: ok')
