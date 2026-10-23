// node src/components/roadmap/timeline.check.mts
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// timeline.ts imports app modules ("@/lib/…", "./layout"): map them to the .ts files so node runs it unbundled
const src = new URL('../../', import.meta.url)
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) return next(new URL(`${spec.slice(2)}.ts`, src).href, ctx)
    if (spec.startsWith('./') && !/\.m?ts$/.test(spec)) return next(`${spec}.ts`, ctx)
    return next(spec, ctx)
  },
})
const { buildTimeline, derivedSpan } = await import('./timeline.ts')

const item = (id: string, parent: string | null, o: object = {}) =>
  ({ id, title: id, parent, status: 'planned', order: 0, tasks: [], due: null, owner: null, priority: null, body: '', file: '', ...o }) as never
const today = '2026-10-23'
const dates = {
  T1: { started: '2026-08-03', finished: '2026-08-20' },
  T2: { started: '2026-09-01', finished: '2026-09-15' },
  T3: { started: '2026-10-01', finished: null },
  T4: { started: null, finished: null },
}
const items = [
  item('H1', null), item('A', 'H1', { tasks: ['T1', 'T2'], status: 'done' }), item('B', 'H1', { tasks: ['T3'] }),
  item('C', 'H1', { tasks: ['T4'] }), item('D', 'H1', { due: '2026-11-10' }),
]

// epic span = earliest Started → latest Done, or today while a task is open; nothing started = no span
assert.deepEqual(derivedSpan(items[1], items, dates, today), { start: '2026-08-03', end: '2026-09-15' })
assert.deepEqual(derivedSpan(items[2], items, dates, today), { start: '2026-10-01', end: today })
assert.equal(derivedSpan(items[3], items, dates, today), null)
// a horizon spans its epics' tasks
assert.deepEqual(derivedSpan(items[0], items, dates, today), { start: '2026-08-03', end: today })

const tl = buildTimeline(items, today, (m) => String(m), [], dates)
const mk = Object.fromEntries(tl.lanes[0].markers.map((m) => [m.item.id, m]))
assert.equal(mk.D.derived, false); assert.equal(mk.D.startX, mk.D.x) // a Due wins
assert.equal(mk.A.derived, true); assert.ok(mk.A.startX < mk.A.x)
assert.equal(mk.B.end, today); assert.ok(Math.abs(mk.B.x - tl.todayX) < 1e-9)
assert.deepEqual(tl.undated.map((i: { id: string }) => i.id), ['C']) // only the never-started epic is undated
assert.ok(tl.months[0].x === 0 && tl.width >= 6 * 160)
// overlapping spans never share a row
assert.notEqual(mk.H1.row, mk.A.row)

// no task dates: the old behaviour (markers only for Due)
const plain = buildTimeline(items, today, (m) => String(m))
assert.deepEqual(plain.lanes[0].markers.map((m) => m.item.id), ['D'])
console.log('timeline ok')
