// Self-check for task statuses. Run: node src/lib/statuses.check.mts
import assert from 'node:assert/strict'
import { BUILTIN_STATUSES, DEFAULT_STATUSES, STATUS_ICONS, displayStatus, invalidStatusId, resolveStatus, statusDefs, statusLine } from './statuses.ts'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Projects without the setting behave exactly as before
assert.deepEqual(statusDefs(undefined), DEFAULT_STATUSES)
for (const s of BUILTIN_STATUSES) {
  assert.equal(statusLine(s), `${STATUS_ICONS[s]} ${cap(s)}`, `built-in line for ${s} unchanged`)
  assert.deepEqual(resolveStatus(`${STATUS_ICONS[s]} ${cap(s)}`), { status: s })
}
assert.deepEqual(resolveStatus('Ready'), { status: 'todo' })
assert.deepEqual(resolveStatus('In review'), { status: 'review' })
assert.deepEqual(resolveStatus('On hold'), { status: 'paused' })
assert.deepEqual(resolveStatus('whatever'), { status: 'todo', unknown: true })

// A custom QA status in the review category
const defs = statusDefs([
  { id: 'todo', label: 'Backlog' },
  { id: 'qa', label: 'QA', color: 'accent', category: 'review' },
  { id: 'design-review', label: 'Design review', color: 'pink', category: 'review' },
  { id: 'wip', label: 'Clash', category: 'in-progress' },           // alias of a built-in → dropped
  { id: 'Bad Id!', label: 'x', category: 'todo' },                   // malformed → dropped
  { id: 'nocat', label: 'x' },                                       // no category → dropped
  { id: 'qa', label: 'dup', category: 'todo' },                      // duplicate → dropped
])
assert.deepEqual(defs.map((d) => d.id), ['todo', 'qa', 'design-review', 'in-progress', 'review', 'blocked', 'paused', 'done', 'cancelled'])
assert.equal(defs[0].label, 'Backlog'); assert.equal(defs[0].category, 'todo')
assert.deepEqual(resolveStatus('👀 Qa', defs), { status: 'review', customStatus: 'qa' })
assert.deepEqual(resolveStatus('qa', defs), { status: 'review', customStatus: 'qa' })
assert.deepEqual(resolveStatus('👀 Design-review', defs), { status: 'review', customStatus: 'design-review' })
assert.deepEqual(resolveStatus('Design review', defs), { status: 'review', customStatus: 'design-review' })
assert.equal(statusLine('qa', defs), '👀 Qa')
assert.equal(statusLine('design-review', defs), '👀 Design-review')
assert.deepEqual(resolveStatus('👀 Qa'), { status: 'todo', unknown: true }, 'a removed custom status reads as todo')
assert.equal(displayStatus({ status: 'review', customStatus: 'qa' }), 'qa')
assert.equal(displayStatus({ status: 'review' }), 'review')

assert.equal(invalidStatusId('qa'), null)
assert.ok(invalidStatusId('done'))
assert.ok(invalidStatusId('hold'))
assert.ok(invalidStatusId('in-review'), '"in review" is an alias')
assert.ok(invalidStatusId('QA'))

console.log('statuses: ok')
