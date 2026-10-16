// Self-check for the cross-project inbox. Run: node src/lib/inbox.check.mts
import assert from 'node:assert/strict'
import { buildInbox, sortInbox, taskKind, type InboxChatInput, type InboxTaskInput } from './inbox.ts'

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
  ['chat-waiting', 'Bravo', 'c-wait'], // newest first: B's chat beats A's older review
  ['failed-run', 'Alpha', 'T2'],
  ['needs-test', 'Bravo', 'T8'],
  ['review', 'Alpha', 'T1'],
  ['blocked', 'Bravo', 'T9'], // unknown time last
])
assert.deepEqual(items[0], { kind: 'chat-waiting', project: b, id: 'c-wait', title: 'c-wait chat', since: T(5), href: '/chat?id=c-wait&project=bravo' })
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

// stable ties: same time → project id, then item id
const tie = sortInbox([
  { kind: 'review', project: b, id: 'T1', title: '', since: T(1), href: '' },
  { kind: 'review', project: a, id: 'T2', title: '', since: T(1), href: '' },
  { kind: 'review', project: a, id: 'T1', title: '', since: T(1), href: '' },
])
assert.deepEqual(tie.map((i) => `${i.project.id}/${i.id}`), ['alpha/T1', 'alpha/T2', 'bravo/T1'])

console.log('inbox: ok')
