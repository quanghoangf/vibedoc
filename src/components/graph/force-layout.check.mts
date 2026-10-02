// node src/components/graph/force-layout.check.mts
import assert from 'node:assert/strict'
import { forceLayout, graphChanges, hiddenLabels, neighbourhoodIds, SPRING, springStep, stepFocus, type SpringWorld } from './force-layout.ts'

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const nodesOf = (ids: string[]) => ids.map(id => ({ id }))
// deterministic "random" without Math.random
let seed = 7
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32)

// two 5-cliques joined by one edge, plus 3 orphans
const A = ['a1', 'a2', 'a3', 'a4', 'a5'], B = ['b1', 'b2', 'b3', 'b4', 'b5'], O = ['o1', 'o2', 'o3']
const clique = (xs: string[]) => xs.flatMap((x, i) => xs.slice(i + 1).map(y => ({ from: x, to: y })))
const edges = [...clique(A), ...clique(B), { from: 'a1', to: 'b1' }]
const nodes = nodesOf([...A, ...B, ...O])
const pos = forceLayout(nodes, edges)
assert.equal(Object.keys(pos).length, nodes.length)

// shuffled input order gives identical positions
const shuffle = <T,>(xs: T[]) => xs.map(x => [rnd(), x] as const).sort((p, q) => p[0] - q[0]).map(p => p[1])
assert.deepEqual(forceLayout(shuffle(nodes), shuffle(edges).map(e => (rnd() < 0.5 ? e : { from: e.to, to: e.from }))), pos)

// cliques: centroids farther apart than any two nodes inside one clique
const centroid = (xs: string[]) => ({ x: xs.reduce((s, id) => s + pos[id].x, 0) / xs.length, y: xs.reduce((s, id) => s + pos[id].y, 0) / xs.length })
const maxInside = Math.max(...[A, B].flatMap(xs => xs.flatMap(x => xs.map(y => dist(pos[x], pos[y])))))
assert.ok(dist(centroid(A), centroid(B)) > maxInside, `cliques ${dist(centroid(A), centroid(B))} vs inside ${maxInside}`)

// average edge length ~120, bounding box centred on 0,0
const avgEdge = edges.reduce((s, e) => s + dist(pos[e.from], pos[e.to]), 0) / edges.length
assert.ok(Math.abs(avgEdge - 120) < 20, `avg edge ${avgEdge}`)
const xs = Object.values(pos).map(p => p.x), ys = Object.values(pos).map(p => p.y)
assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 0.1 && Math.abs(Math.min(...ys) + Math.max(...ys)) < 0.1)

// orphans sit outside the bounding circle of the linked nodes
const linked = [...A, ...B], c = centroid(linked)
const inner = Math.max(...linked.map(id => dist(pos[id], c)))
for (const o of O) assert.ok(dist(pos[o], c) > inner, `${o} inside`)

// 200 random-ish nodes: no two closer than the minimum distance
const big = Array.from({ length: 200 }, (_, i) => `n${String(i).padStart(3, '0')}`)
const bigEdges = big.flatMap((id, i) => (i % 9 === 8 ? [] : [{ from: id, to: big[Math.floor(rnd() * 200)] }]))
const bp = forceLayout(nodesOf(big), bigEdges)
let closest = Infinity
for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) closest = Math.min(closest, dist(bp[big[i]], bp[big[j]]))
assert.ok(closest >= 47.9, `closest pair ${closest}`)

// edge cases
assert.deepEqual(forceLayout([], []), {})
assert.deepEqual(forceLayout([{ id: 'x' }], []), { x: { x: 0, y: 0 } })
assert.deepEqual(Object.keys(forceLayout(nodesOf(['x', 'y']), [{ from: 'x', to: 'x' }, { from: 'x', to: 'zz' }])).sort(), ['x', 'y'])

// neighbourhoodIds on a chain a-b-c-d-e (edges in mixed directions)
const chain = [{ from: 'a', to: 'b' }, { from: 'c', to: 'b' }, { from: 'c', to: 'd' }, { from: 'e', to: 'd' }]
assert.deepEqual([...neighbourhoodIds(chain, 'c', 1)].sort(), ['b', 'c', 'd'])
assert.deepEqual([...neighbourhoodIds(chain, 'c', 2)].sort(), ['a', 'b', 'c', 'd', 'e'])
assert.deepEqual([...neighbourhoodIds(chain, 'a', 2)].sort(), ['a', 'b', 'c'])
assert.deepEqual([...neighbourhoodIds(chain, 'zz', 1)], ['zz'])

// stepFocus: nearest linked node in the arrow's direction, else next/previous by order
const sp = { c: { x: 0, y: 0 }, r: { x: 100, y: -10 }, far: { x: 300, y: 0 }, u: { x: 0, y: -80 }, l: { x: -50, y: 0 }, x: { x: 10, y: 0 } }
const ord = ['c', 'far', 'l', 'r', 'u', 'x']
assert.equal(stepFocus('c', 'ArrowRight', sp, ['r', 'far', 'u', 'l'], ord), 'r')
assert.equal(stepFocus('c', 'ArrowUp', sp, ['r', 'far', 'u', 'l'], ord), 'u')
assert.equal(stepFocus('c', 'ArrowLeft', sp, ['r', 'far', 'u', 'l'], ord), 'l')
assert.equal(stepFocus('c', 'ArrowRight', sp, ['r', 'far'], ord), 'r', 'x is nearer but not linked')
assert.equal(stepFocus('c', 'ArrowDown', sp, ['r', 'u'], ord), 'far', 'nothing linked below: next by order')
assert.equal(stepFocus('c', 'ArrowUp', sp, [], ord), 'x', 'previous by order wraps')
assert.equal(stepFocus('x', 'ArrowDown', sp, [], ord), 'c', 'next by order wraps')
assert.equal(stepFocus('gone', 'ArrowDown', sp, [], ord), 'c', 'unknown start: first')
assert.equal(stepFocus('c', 'ArrowDown', sp, [], []), undefined)

// graphChanges: first load is quiet; new / removed files, both ends of new / removed links, relabels
const g0 = { nodes: [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }, { path: 'c', label: 'C' }], edges: [{ from: 'a', to: 'b' }] }
assert.deepEqual([...graphChanges(null, g0)], [])
assert.deepEqual([...graphChanges(g0, g0)], [], 'same data: nothing changed')
const g1 = { nodes: [{ path: 'a', label: 'A' }, { path: 'b', label: 'B2' }, { path: 'd', label: 'D' }], edges: [{ from: 'd', to: 'a' }] }
assert.deepEqual([...graphChanges(g0, g1)].sort(), ['a', 'b', 'c', 'd'])
const g2 = { ...g0, nodes: g0.nodes.map((n) => (n.path === 'c' ? { ...n, status: 'done' } : n)) }
assert.deepEqual([...graphChanges(g0, g2)], ['c'], 'a status change marks the node')

// timing: 300 nodes / 600 edges
const t300 = Array.from({ length: 300 }, (_, i) => `t${i}`)
const tEdges = Array.from({ length: 600 }, () => ({ from: t300[Math.floor(rnd() * 300)], to: t300[Math.floor(rnd() * 300)] }))
forceLayout(nodesOf(t300), tEdges) // warm up the JIT
const t0 = performance.now()
forceLayout(nodesOf(t300), tEdges)
const ms = performance.now() - t0
console.log(`300 nodes / 600 edges: ${ms.toFixed(1)} ms`)
assert.ok(ms < 150, `too slow: ${ms} ms`)

// hiddenLabels: earlier (higher priority) labels win; kept ids always show; touching edges don't count
const box = (id: string, x: number, y: number) => ({ id, x, y, w: 50, h: 14 })
assert.deepEqual([...hiddenLabels([box('hub', 0, 0), box('leaf', 20, 5), box('far', 200, 0), box('edge', 50, 0)])], ['leaf'])
assert.deepEqual([...hiddenLabels([box('hub', 0, 0), box('sel', 10, 0)], new Set(['sel']))], [])

// springStep: a displaced body springs home with a small overshoot, snaps exactly and is dropped; the loop idles
{
  const w: SpringWorld = { bodies: new Map([['a', { x: 100, y: 0, vx: 0, vy: 0 }]]), layout: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }, shift: {}, drag: null, links: [] }
  let minX = Infinity, frames = 0
  while (springStep(w, 1 / 60)) { minX = Math.min(minX, w.bodies.get('a')?.x ?? 0); frames++; assert.ok(frames < 120, 'at rest within 2s') }
  assert.ok(minX < 0 && minX > -8, `slight overshoot ${minX}`)
  assert.equal(w.bodies.size, 0, 'home again: dropped')
  // a drag pulls a linked neighbour along; release returns it to its layout point
  w.bodies.set('b', { x: 100, y: 0, vx: 0, vy: 0 }).set('a', { x: 0, y: 0, vx: 0, vy: 0 })
  w.links = [{ a: 'a', b: 'b', len: 100, k: SPRING.link }]
  w.drag = { id: 'a', x: -150, y: 0 }
  for (let i = 0; i < 60; i++) assert.equal(springStep(w, 1 / 60), true, 'held: always moving')
  assert.ok(w.bodies.get('b')!.x < 20, `neighbour follows ${w.bodies.get('b')!.x}`)
  w.drag = null
  for (let i = 0; i < 180 && springStep(w, 1 / 60); i++);
  assert.equal(w.bodies.size, 0, 'both back on the layout')
  // magnet: a shifted body rests displaced and the loop goes idle; clearing the shift brings it home
  w.bodies.set('b', { x: 100, y: 0, vx: 0, vy: 0 })
  w.shift = { b: { x: 92, y: 0 } }
  for (let i = 0; i < 180 && springStep(w, 1 / 60); i++);
  assert.deepEqual(w.bodies.get('b'), { x: 92, y: 0, vx: 0, vy: 0 })
  assert.equal(springStep(w, 1 / 60), false, 'displaced but idle')
  w.shift = {}
  for (let i = 0; i < 180 && springStep(w, 1 / 60); i++);
  assert.equal(w.bodies.size, 0)
  // a huge dt (tab was hidden) is clamped
  w.bodies.set('b', { x: 200, y: 0, vx: 0, vy: 0 })
  springStep(w, 5)
  assert.ok(Math.abs(w.bodies.get('b')!.x - 100) < 100, 'no fly-off')
}
console.log('force-layout ok')
