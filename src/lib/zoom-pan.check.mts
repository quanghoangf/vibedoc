// node src/lib/zoom-pan.check.mts
import assert from 'node:assert/strict'
import { DIAGRAM_FIT_FLOOR, FIT, MAX_SCALE, MIN_SCALE, diagramView, panBy, zoomAt } from './zoom-pan.ts'

// the point under the cursor stays put: stage coords (p - t) / s are the same before and after
const under = (s: { x: number; y: number; scale: number }, p: { x: number; y: number }) => [(p.x - s.x) / s.scale, (p.y - s.y) / s.scale]
const p = { x: 300, y: 120 }
const z = zoomAt(FIT, 2, p)
assert.equal(z.scale, 2)
assert.deepEqual(under(z, p), under(FIT, p))
const z2 = zoomAt(panBy(z, -40, 25), 0.5, { x: 10, y: 500 })
assert.deepEqual(under(z2, { x: 10, y: 500 }).map(Math.round), under(panBy(z, -40, 25), { x: 10, y: 500 }).map(Math.round))

// clamped both ways; a clamped zoom doesn't drift
assert.equal(zoomAt(FIT, 100, p).scale, MAX_SCALE)
assert.equal(zoomAt(FIT, 0.001, p).scale, MIN_SCALE)
const top = zoomAt(FIT, 100, p)
assert.deepEqual(zoomAt(top, 2, { x: 0, y: 0 }), top)

assert.deepEqual(panBy(FIT, 5, -7), { x: 5, y: -7, scale: 1 })
// diagramView: fits → as drawn; fit to width down to the 60% floor, below it actual size; the reader's pick wins
assert.deepEqual(diagramView(500, 800, null), { overflow: false, actual: false, scale: 1 })
assert.deepEqual(diagramView(1000, 800, null), { overflow: true, actual: false, scale: 0.8 })
assert.deepEqual(diagramView(1000, 600, null), { overflow: true, actual: false, scale: DIAGRAM_FIT_FLOOR })
assert.deepEqual(diagramView(4000, 800, null), { overflow: true, actual: true, scale: 1 }, '20% would be unreadable: actual size')
assert.deepEqual(diagramView(4000, 800, 'fit'), { overflow: true, actual: false, scale: 0.2 }, 'the reader asked to fit')
assert.deepEqual(diagramView(1000, 800, 'actual'), { overflow: true, actual: true, scale: 1 })
assert.deepEqual(diagramView(500, 800, 'actual'), { overflow: false, actual: false, scale: 1 }, 'a pick means nothing once it fits')
console.log('zoom-pan: ok')
