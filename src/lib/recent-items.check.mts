// node src/lib/recent-items.check.mts
import assert from 'node:assert/strict'
import { emptyRecent, parseRecent, pushRecent, recentCookie, RECENT_CAP } from './recent-items.ts'

// garbage never throws
assert.deepEqual(parseRecent(null), emptyRecent())
assert.deepEqual(parseRecent('not json'), emptyRecent())
assert.deepEqual(parseRecent('[1,2]'), emptyRecent())
assert.deepEqual(parseRecent('{"task":"T1"}'), emptyRecent())

// invalid ids per kind are dropped, duplicates removed, capped
const r = parseRecent(JSON.stringify({
  task: ['T216', 'R001', 'T216', 'T1', 'T2', 'T3', 'T4', 'T5'],
  epic: ['R066', 'T001'],
  doc: ['docs/x.md', '../etc/passwd.md', '/abs.md', 'docs/y.txt'],
  entry: ['E012', 'e1'],
  bogus: ['x'],
}))
assert.deepEqual(r.task, ['T216', 'T1', 'T2', 'T3', 'T4'])
assert.equal(r.task.length, RECENT_CAP)
assert.deepEqual(r.epic, ['R066'])
assert.deepEqual(r.doc, ['docs/x.md'])
assert.deepEqual(r.entry, ['E012'])
assert.deepEqual(r.test, [])

// push moves to front, dedupes, caps; no-op returns the same object
let s = emptyRecent()
s = pushRecent(s, 'task', 'T1')
s = pushRecent(s, 'task', 'T2')
s = pushRecent(s, 'task', 'T1')
assert.deepEqual(s.task, ['T1', 'T2'])
assert.equal(pushRecent(s, 'task', 'T1'), s)
assert.equal(pushRecent(s, 'task', 'nope'), s)
for (const id of ['T3', 'T4', 'T5', 'T6']) s = pushRecent(s, 'task', id)
assert.deepEqual(s.task, ['T6', 'T5', 'T4', 'T3', 'T1'])

// round trip through the cookie
s = pushRecent(s, 'doc', 'docs/a b.md')
const cookie = recentCookie(s)
assert.match(cookie, /^vibedoc-recent=[^;]+; path=\/; max-age=31536000; samesite=lax$/)
const value = decodeURIComponent(cookie.slice('vibedoc-recent='.length, cookie.indexOf(';')))
assert.deepEqual(parseRecent(value), s)
assert.ok(!value.includes('"epic"'), 'empty kinds are left out')

console.log('recent-items: ok')
