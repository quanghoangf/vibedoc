// Self-check for the cross-project inbox. Run: node src/lib/inbox.check.mts
import assert from 'node:assert/strict'
import { approveRisk, buildInbox, needsYouCount, taskEvidence, sortInbox, taskKind, type InboxChatInput, type InboxTaskInput } from './inbox.ts'

const T = (min: number) => new Date(Date.UTC(2026, 9, 16, 9, min)).toISOString()
const task = (id: string, o: Partial<InboxTaskInput> = {}): InboxTaskInput =>
  ({ id, title: `${id} title`, status: 'todo', failedRun: false, needsTest: false, since: T(0), ...o })
const chat = (id: string, o: Partial<InboxChatInput> = {}): InboxChatInput => ({ id, title: `${id} chat`, waiting: true, since: T(0), ...o })

// every kind, one item per task with precedence failed-run > blocked > review > needs-test
assert.equal(taskKind(task('T1', { status: 'review', failedRun: true, needsTest: true })), 'failed-run')
assert.equal(taskKind(task('T1', { status: 'blocked', needsTest: true })), 'blocked')
assert.equal(taskKind(task('T1', { status: 'review', needsTest: true })), 'review')
assert.equal(taskKind(task('T1', { needsTest: true })), 'needs-test')
assert.equal(taskKind(task('T1', { status: 'in-progress' })), null)
assert.equal(taskKind(task('T1', { status: 'done' })), null)

const a = { id: 'alpha', name: 'Alpha' }
const b = { id: 'bravo', name: 'Bravo' }
const items = buildInbox([
  { project: a, tasks: [task('T1', { status: 'review', since: T(1) }), task('T2', { failedRun: true, since: T(3) }), task('T3', { status: 'done' })], chats: [chat('c-idle', { waiting: false })] },
  { project: b, tasks: [task('T9', { status: 'blocked', since: null }), task('T8', { needsTest: true, since: T(2) })], chats: [chat('c-wait', { since: T(5) })] },
])
assert.deepEqual(items.map((i) => [i.kind, i.project.name, i.id]), [
  ['failed-run', 'Alpha', 'T2'], // failed runs first, whatever their age
  ['chat-waiting', 'Bravo', 'c-wait'], // then newest first: B's chat beats A's older review
  ['needs-test', 'Bravo', 'T8'],
  ['review', 'Alpha', 'T1'],
  ['blocked', 'Bravo', 'T9'], // unknown time last
])
assert.deepEqual(items[1], { kind: 'chat-waiting', project: b, id: 'c-wait', title: 'c-wait chat', since: T(5), href: '/chat?id=c-wait&project=bravo' })
assert.equal(items.find((i) => i.id === 'T1')?.href, '/board?task=T1&project=alpha')
assert.equal(items.find((i) => i.id === 'T2')?.href, '/manual-tests?task=T2&project=alpha')
assert.equal(items.find((i) => i.id === 'T9')?.href, '/board?task=T9&project=bravo')

// archived and missing projects are skipped; ?project= keeps one
const withHidden = [
  { project: { ...a, archived: true }, tasks: [task('T1', { status: 'review' })], chats: [chat('c1')] },
  { project: { ...b, missing: true }, tasks: [task('T2', { status: 'review' })], chats: [] },
  { project: { id: 'charlie', name: 'Charlie' }, tasks: [task('T3', { status: 'review' })], chats: [] },
]
assert.deepEqual(buildInbox(withHidden).map((i) => i.project.id), ['charlie'])
assert.deepEqual(buildInbox([{ project: a, tasks: [task('T1', { status: 'review' })], chats: [] }, { project: b, tasks: [task('T2', { status: 'review' })], chats: [] }], { project: 'bravo' }).map((i) => i.id), ['T2'])

// a group's members only; an empty set (unknown group) keeps nothing; root rides along for actions
assert.deepEqual(buildInbox(withHidden.slice(2), { projects: new Set(['charlie']) }).map((i) => i.id), ['T3'])
assert.deepEqual(buildInbox(withHidden.slice(2), { projects: new Set() }), [])
assert.equal(buildInbox([{ project: { ...a, root: '/r/a' }, tasks: [task('T1', { status: 'review' })], chats: [] }])[0].project.root, '/r/a')

// an auto-fix-limit review goes first too, ahead of a newer review
const limit = buildInbox([{ project: a, tasks: [task('T1', { status: 'review', since: T(9) }), task('T2', { status: 'review', autoFixLimit: true, since: T(1) })], chats: [] }])
assert.deepEqual(limit.map((i) => i.id), ['T2', 'T1'])

// evidence rides on task rows; a failed flag without a run result still reads failed
const ev = buildInbox([{ project: a, tasks: [
  task('T1', { status: 'review', checks: { proven: 1, total: 7 }, run: 'none' }),
  task('T2', { failedRun: true, failedStep: 2 }),
], chats: [chat('c1')] }])
assert.deepEqual(ev.find((i) => i.id === 'T1')?.evidence, { checks: { proven: 1, total: 7 }, run: 'none', failedStep: null, autoFixLimit: false })
assert.deepEqual(ev.find((i) => i.id === 'T2')?.evidence, { checks: null, run: 'failed', failedStep: 2, autoFixLimit: false })
assert.equal(ev.find((i) => i.id === 'c1')?.evidence, undefined)

// epic tally over the project's tasks (cancelled left out), for the closure line after an approve
const ep = buildInbox([{ project: a, tasks: [
  task('T1', { status: 'review', epicId: 'R9' }), task('T2', { status: 'done', epicId: 'R9' }),
  task('T3', { status: 'todo', epicId: 'R9' }), task('T4', { status: 'cancelled', epicId: 'R9' }), task('T5', { status: 'review' }),
], chats: [] }])
assert.deepEqual(ep.find((i) => i.id === 'T1')?.epic, { id: 'R9', done: 1, total: 3 })
assert.equal(ep.find((i) => i.id === 'T5')?.epic, undefined)

// one definition: /projects' count is the project's inbox rows, archived or not
const one = { project: { ...a, archived: true }, tasks: [task('T1', { status: 'review' }), task('T2', { status: 'blocked' }), task('T3')], chats: [chat('c1'), chat('c2', { waiting: false })] }
assert.equal(needsYouCount(one), 3)
assert.equal(needsYouCount({ ...one, project: a }), buildInbox([{ ...one, project: a }]).length)

// stable ties: same time → project id, then item id
const tie = sortInbox([
  { kind: 'review', project: b, id: 'T1', title: '', since: T(1), href: '' },
  { kind: 'review', project: a, id: 'T2', title: '', since: T(1), href: '' },
  { kind: 'review', project: a, id: 'T1', title: '', since: T(1), href: '' },
])
assert.deepEqual(tie.map((i) => `${i.project.id}/${i.id}`), ['alpha/T1', 'alpha/T2', 'bravo/T1'])

// T558: a waiting worker's row names its branch and task
const workers = buildInbox([{ project: a, tasks: [], chats: [
  chat('c-w1', { title: 'Worker R108', worker: { branch: 'vibedoc/R108', taskId: 'T558' } }),
  chat('c-w2', { title: 'Worker R109', worker: { branch: 'vibedoc/R109', taskId: null }, since: T(1) }),
] }])
assert.deepEqual(workers.map((i) => i.title), ['Worker · vibedoc/R109', 'Worker · vibedoc/R108 · T558'])
assert.equal(workers[1].href, '/chat?id=c-w1&project=alpha')

// One Approve rule: unproven checks or a failed run make it risky, and the label can say which
assert.equal(approveRisk(null), null)
assert.equal(approveRisk({ checks: { proven: 8, total: 8 }, run: 'passed' }), null)
assert.equal(approveRisk({ checks: null, run: 'none' }), null)
assert.deepEqual(approveRisk({ checks: { proven: 0, total: 8 }, run: 'none' }), { unchecked: 8, failedRun: false })
assert.deepEqual(approveRisk({ checks: null, run: 'failed' }), { unchecked: 0, failedRun: true })
const taskEv = taskEvidence({ manualTests: { total: 5, untested: 2, autoRun: { result: 'passed' } }, lastRun: { status: 'failed' } })
assert.deepEqual(taskEv, { checks: { proven: 3, total: 5 }, run: 'failed' })
assert.deepEqual(taskEvidence({ manualTests: { total: 0, untested: 0, autoRun: null }, lastRun: null }), { checks: null, run: 'none' })

console.log('inbox: ok')
