// node src/components/graph/force-layout.check.mts
import assert from 'node:assert/strict'
import { forceLayout, neighbourhoodIds, stepFocus } from './force-layout.ts'

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

// timing: 300 nodes / 600 edges
const t300 = Array.from({ length: 300 }, (_, i) => `t${i}`)
const tEdges = Array.from({ length: 600 }, () => ({ from: t300[Math.floor(rnd() * 300)], to: t300[Math.floor(rnd() * 300)] }))
forceLayout(nodesOf(t300), tEdges) // warm up the JIT
const t0 = performance.now()
forceLayout(nodesOf(t300), tEdges)
const ms = performance.now() - t0
console.log(`300 nodes / 600 edges: ${ms.toFixed(1)} ms`)
assert.ok(ms < 150, `too slow: ${ms} ms`)
console.log('force-layout ok')
