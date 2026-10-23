// node src/lib/sidebar-items.check.mts
import assert from 'node:assert/strict'
import { disclosureCookie, isExpanded, MAX_NEEDS, parseDisclosure, sidebarChildren, type SidebarInput, type TaskLite } from './sidebar-items.ts'

const task = (id: string, status: string, extra: Partial<TaskLite> = {}): TaskLite =>
  ({ id, title: `Task ${id}`, status, manualTests: null, lastRun: null, ...extra })
// the same shape of rule as test-review's needsYou, enough to drive the picker
const needsYou = (t: TaskLite) => t.lastRun?.status === 'failed' || t.status === 'review' || ((t.manualTests?.untested ?? 0) > 0 && t.status !== 'done')

const base = (over: Partial<SidebarInput> = {}): SidebarInput => ({
  tasks: [], needsYou, epics: [], drift: [], docs: [], lint: [], cleanupFlags: 0, ...over,
})

// Acceptance: a task in review + an overdue epic → Board / Manual tests show the task, Roadmap the epic, as needs-action
{
  const out = sidebarChildren(base({
    tasks: [task('T1', 'review'), task('T2', 'todo')],
    epics: [{ id: 'R9', title: 'Late epic' }],
    drift: [{ id: 'R9', kind: 'at-risk' }, { id: 'R9', kind: 'overdue' }],
  }))
  assert.deepEqual(out['/board'].map((c) => [c.id, c.reason, c.hint, c.href]), [['T1', 'needs-action', 'review', '/board?task=T1']])
  assert.deepEqual(out['/manual-tests'].map((c) => [c.id, c.hint, c.href]), [['T1', 'review', '/manual-tests?task=T1']])
  // one row per epic, its worst drift
  assert.deepEqual(out['/roadmap'].map((c) => [c.id, c.hint, c.tone, c.href]), [['R9', 'overdue', 'danger', '/roadmap?item=R9']])
}

// needs-action only: no "Viewed" history, nothing for a page with nothing to do
{
  const out = sidebarChildren(base({ tasks: [task('T1', 'blocked'), task('T2', 'todo')], docs: [{ path: 'docs/x.md', name: 'x' }] }))
  assert.deepEqual(out['/board'].map((c) => [c.id, c.reason, c.hint]), [['T1', 'needs-action', 'blocked']])
  assert.deepEqual(out['/roadmap'], [])
  assert.deepEqual(out['/docs'], [])
  assert.deepEqual(out['/memory'], [])
}

// not loaded yet (null): epics can't be named, so Roadmap lists nothing
{
  const out = sidebarChildren(base({ epics: null, docs: null, drift: [{ id: 'R1', kind: 'overdue' }] }))
  assert.deepEqual(out['/roadmap'], [])
}

// cap: at most MAX_NEEDS rows, no "+N more" (the page lists the rest)
{
  const tasks = ['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => task(id, 'review'))
  const out = sidebarChildren(base({ tasks }))
  assert.equal(out['/board'].length, MAX_NEEDS)
  assert.deepEqual(out['/board'].map((c) => c.id), ['T1', 'T2', 'T3'])
}

// manual tests order: failed, unverified, review, checks left
{
  const out = sidebarChildren(base({
    tasks: [
      task('T1', 'in-progress', { manualTests: { untested: 2, autoRun: null } }),
      task('T2', 'review'),
      task('T3', 'done', { lastRun: { status: 'failed' } }),
    ],
  }))
  assert.deepEqual(out['/manual-tests'].map((c) => [c.id, c.hint, c.n]), [['T3', 'failed', undefined], ['T2', 'review', undefined], ['T1', 'checks', 2]])
}

// docs: errors (most first) before outdated; memory cleanup row
{
  const out = sidebarChildren(base({
    docs: null,
    lint: [{ path: 'docs/a.md', errors: 1, outdated: 0 }, { path: 'docs/b.md', errors: 0, outdated: 1 }, { path: 'docs/c.md', errors: 3, outdated: 1 }, { path: 'docs/d.md', errors: 0, outdated: 0 }],
    cleanupFlags: 2,
  }))
  assert.deepEqual(out['/docs'].map((c) => [c.id, c.hint, c.n]), [['docs/c.md', 'lint', 3], ['docs/a.md', 'lint', 1], ['docs/b.md', 'outdated', undefined]])
  assert.deepEqual(out['/memory'].map((c) => [c.kind, c.n, c.href]), [['cleanup', 2, '/memory?cleanup=1']])
}

// disclosure cookie
{
  const d = parseDisclosure('board:0,docs:1,nope:1,roadmap:x')
  assert.deepEqual(d, { '/board': false, '/docs': true })
  assert.equal(disclosureCookie(d), 'vibedoc-sidebar=board:0,docs:1; path=/; max-age=31536000; samesite=lax')
  assert.deepEqual(parseDisclosure(null), {})
  // explicit choice wins; otherwise collapsed (every page link stays above the fold)
  assert.equal(isExpanded('/board', d), false)
  assert.equal(isExpanded('/docs', d), true)
  assert.equal(isExpanded('/roadmap', d), false)
}

console.log('sidebar-items: ok')
