// Self-check for automatic task dates. Run: node src/lib/auto-dates.check.mts
import assert from 'node:assert/strict'
import { addDays, datesOnMove, sizeLetter } from './auto-dates.ts'

const none = { due: null, started: null, done: null }

assert.equal(addDays('2026-10-01', 3), '2026-10-04')
assert.equal(addDays('2026-12-30', 3), '2027-01-02', 'crosses the year')
assert.equal(addDays('2028-02-28', 1), '2028-02-29', 'leap day')
assert.equal(sizeLetter('M (2–3 hrs)'), 'M')
assert.equal(sizeLetter('xl'), 'XL')
assert.equal(sizeLetter('—'), null)

// the acceptance case: claim an M task on 2026-10-01 with no due
assert.deepEqual(datesOnMove('in-progress', none, 'M', '2026-10-01'), { due: '2026-10-04', started: '2026-10-01', done: null })
// a hand-set due is never overwritten
assert.equal(datesOnMove('in-progress', { ...none, due: '2026-12-01' }, 'M', '2026-10-01').due, '2026-12-01')
// restarting keeps the first start, and the due computed from it
assert.deepEqual(
  datesOnMove('in-progress', { due: '2026-10-04', started: '2026-10-01', done: null }, 'M', '2026-10-09'),
  { due: '2026-10-04', started: '2026-10-01', done: null },
)
// no size → no due
assert.equal(datesOnMove('in-progress', none, '—', '2026-10-01').due, null)
// custom days from settings
assert.equal(datesOnMove('in-progress', none, 'S', '2026-10-01', { S: 2 }).due, '2026-10-03')
// done stamps, reopening clears Done
assert.equal(datesOnMove('done', none, 'M', '2026-10-05').done, '2026-10-05')
assert.equal(datesOnMove('todo', { ...none, done: '2026-10-05' }, 'M', '2026-10-06').done, null)
// other moves change nothing
assert.deepEqual(datesOnMove('blocked', none, 'M', '2026-10-01'), none)

console.log('auto-dates: ok')
