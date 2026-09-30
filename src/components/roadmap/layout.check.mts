// node src/components/roadmap/layout.check.mts
import assert from 'node:assert/strict'
import { arrangePositions } from './layout.ts'

const item = (id: string, parent: string | null, order: number) =>
  ({ id, title: id, parent, status: 'planned', order, tasks: [], due: null, owner: null, priority: null, body: '', file: '' }) as never
const items = [
  item('R1', null, 1), item('R2', null, 2),
  ...Array.from({ length: 21 }, (_, i) => item(`E${i}`, 'R1', i)),
  item('F0', 'R2', 0), item('F1', 'R2', 1), item('F2', 'R2', 2),
]
const height = (id: string) => (id.startsWith('R') ? 56 : id === 'E3' ? 90 : 34)
const pos = arrangePositions(items, height)

// every item placed; horizons on the spine, in order
assert.equal(Object.keys(pos).length, items.length)
assert.equal(pos.R1.x, 0); assert.equal(pos.R2.x, 0)
assert.ok(pos.R2.y > pos.R1.y)

// no two nodes in the same column overlap (heights + gap), across blocks too
const boxes = Object.entries(pos).map(([id, p]) => ({ id, x: p.x, top: p.y, bottom: p.y + height(id) }))
for (const a of boxes) for (const b of boxes) {
  if (a.id >= b.id || a.x !== b.x) continue
  assert.ok(a.bottom <= b.top || b.bottom <= a.top, `${a.id} overlaps ${b.id}`)
}

// sides balanced by height, both columns centred on their horizon
const right = boxes.filter((b) => b.id.startsWith('E') && b.x > 0), left = boxes.filter((b) => b.id.startsWith('E') && b.x < 0)
assert.ok(Math.abs(right.length - left.length) <= 2)
const mid = (bs: typeof boxes) => (Math.min(...bs.map((b) => b.top)) + Math.max(...bs.map((b) => b.bottom))) / 2
assert.ok(Math.abs(mid(right) - (pos.R1.y + 28)) < 1 && Math.abs(mid(left) - (pos.R1.y + 28)) < 1)

// order is kept down each side
const rightIds = right.sort((a, b) => a.top - b.top).map((b) => Number(b.id.slice(1)))
assert.deepEqual(rightIds, [...rightIds].sort((a, b) => a - b))

// R2's block starts below R1's lowest epic
assert.ok(Math.min(pos.R2.y, pos.F0.y, pos.F1.y) > Math.max(...boxes.filter((b) => b.id.startsWith('E')).map((b) => b.bottom)))
console.log('layout ok')
