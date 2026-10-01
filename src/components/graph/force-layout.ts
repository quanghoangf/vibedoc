// Pure, deterministic force layout for the doc graph (/graph). No React, no fs, no Math.random:
// the same nodes and edges always give the same positions, whatever their input order.

export type Point = { x: number; y: number }
export type ForceLayoutOptions = {
  /** Simulation steps; the temperature cools linearly to ~0 over them. */
  iterations?: number
  /** Average edge length of the output, in px. */
  edgeLength?: number
  /** No two nodes end up closer than this, in px. */
  minDistance?: number
}

/** FNV-1a 32-bit, mapped to [0, 1). */
function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 2 ** 32
}

/**
 * Positions keyed by node id. Linked nodes pull together, everything repels, a weak pull to the centre keeps
 * disconnected components close, and nodes without edges form a ring outside the rest (Obsidian orphans).
 * The bounding box is centred on 0,0 and the average edge is ~`edgeLength` px; React Flow's fitView does the rest.
 */
export function forceLayout(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  opts: ForceLayoutOptions = {},
): Record<string, Point> {
  const { iterations = 300, edgeLength = 120, minDistance = 48 } = opts
  const ids = [...new Set(nodes.map(n => n.id))].sort()
  const index = new Map(ids.map((id, i) => [id, i]))
  // undirected, deduped, sorted pairs of known distinct nodes
  const pairKeys = new Set<string>()
  const links: [number, number][] = []
  for (const e of edges) {
    const a = index.get(e.from), b = index.get(e.to)
    if (a === undefined || b === undefined || a === b) continue
    const [i, j] = a < b ? [a, b] : [b, a]
    if (pairKeys.has(`${i} ${j}`)) continue
    pairKeys.add(`${i} ${j}`)
    links.push([i, j])
  }
  links.sort((p, q) => p[0] - q[0] || p[1] - q[1])

  const degree = ids.map(() => 0)
  for (const [i, j] of links) { degree[i]++; degree[j]++ }
  const linked = ids.map((_, i) => i).filter(i => degree[i] > 0)
  const n = linked.length

  // Seeded start from each id's own hash, so adding one doc barely moves the others' start.
  const K = 1 // ideal edge length in simulation units; rescaled at the end
  const spread = Math.sqrt(Math.max(n, 1)) * K
  const xs = ids.map(id => (hash01(id) - 0.5) * spread)
  const ys = ids.map(id => (hash01(`${id}\u0000y`) - 0.5) * spread)

  // ponytail: O(n²) repulsion per step, fine to ~500 nodes; Barnes-Hut (quadtree) if graphs get bigger.
  const dx = new Float64Array(ids.length), dy = new Float64Array(ids.length)
  const gravity = 0.05
  for (let step = 0; step < iterations; step++) {
    const temp = spread * 0.1 * (1 - step / iterations) + 0.001
    dx.fill(0); dy.fill(0)
    for (let a = 0; a < n; a++) {
      const i = linked[a]
      for (let b = a + 1; b < n; b++) {
        const j = linked[b]
        let ex = xs[i] - xs[j], ey = ys[i] - ys[j]
        let d2 = ex * ex + ey * ey
        if (d2 < 1e-9) { ex = (i - j) * 1e-3; ey = 1e-3; d2 = ex * ex + ey * ey } // coincident: split by index
        const f = (K * K) / d2 // repulsion K²/d, as a factor on the (ex, ey) vector
        dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f
      }
    }
    for (const [i, j] of links) {
      const ex = xs[i] - xs[j], ey = ys[i] - ys[j]
      const f = Math.sqrt(ex * ex + ey * ey) / K // spring d²/K
      dx[i] -= ex * f; dy[i] -= ey * f; dx[j] += ex * f; dy[j] += ey * f
    }
    for (const i of linked) {
      dx[i] -= xs[i] * gravity; dy[i] -= ys[i] * gravity
      const len = Math.hypot(dx[i], dy[i])
      if (len > 0) { const m = Math.min(len, temp) / len; xs[i] += dx[i] * m; ys[i] += dy[i] * m }
    }
  }

  // Scale to the average edge length, then push apart any pair still closer than minDistance.
  const avg = links.reduce((s, [i, j]) => s + Math.hypot(xs[i] - xs[j], ys[i] - ys[j]), 0) / (links.length || 1)
  const scale = avg > 0 ? edgeLength / avg : 1
  for (const i of linked) { xs[i] *= scale; ys[i] *= scale }
  for (let pass = 0; pass < 50; pass++) {
    let moved = false
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const i = linked[a], j = linked[b]
      let ex = xs[j] - xs[i], ey = ys[j] - ys[i]
      let d = Math.hypot(ex, ey)
      if (d >= minDistance) continue
      if (d < 1e-6) { ex = 1; ey = 0; d = 1 }
      const push = (minDistance - d) / 2 + 0.5
      xs[i] -= (ex / d) * push; ys[i] -= (ey / d) * push
      xs[j] += (ex / d) * push; ys[j] += (ey / d) * push
      moved = true
    }
    if (!moved) break
  }

  // Orphans: an even ring outside the linked nodes' bounding circle, in id order.
  const cx = n ? linked.reduce((s, i) => s + xs[i], 0) / n : 0
  const cy = n ? linked.reduce((s, i) => s + ys[i], 0) / n : 0
  const inner = linked.reduce((r, i) => Math.max(r, Math.hypot(xs[i] - cx, ys[i] - cy)), 0)
  const orphans = ids.map((_, i) => i).filter(i => degree[i] === 0)
  if (orphans.length) {
    const fit = orphans.length > 1 ? minDistance / (2 * Math.sin(Math.PI / orphans.length)) : 0
    const r = Math.max(n ? inner + edgeLength : 0, fit)
    orphans.forEach((i, k) => {
      const t = (2 * Math.PI * k) / orphans.length - Math.PI / 2
      xs[i] = cx + r * Math.cos(t); ys[i] = cy + r * Math.sin(t)
    })
  }

  // Centre the bounding box on 0,0.
  const all = ids.map((_, i) => i)
  const midX = all.length ? (Math.min(...all.map(i => xs[i])) + Math.max(...all.map(i => xs[i]))) / 2 : 0
  const midY = all.length ? (Math.min(...all.map(i => ys[i])) + Math.max(...all.map(i => ys[i]))) / 2 : 0
  const out: Record<string, Point> = {}
  ids.forEach((id, i) => { out[id] = { x: Math.round((xs[i] - midX) * 100) / 100, y: Math.round((ys[i] - midY) * 100) / 100 } })
  return out
}

/** The ids within `depth` hops of `id`, either edge direction, including `id` itself. Used by Focus on /graph. */
export function neighbourhoodIds(edges: { from: string; to: string }[], id: string, depth: 1 | 2): Set<string> {
  const seen = new Set([id])
  let frontier = [id]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const e of edges) {
      for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) {
        if (frontier.includes(a) && !seen.has(b)) { seen.add(b); next.push(b) }
      }
    }
    frontier = next
  }
  return seen
}

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"

/**
 * Where an arrow key moves keyboard focus on /graph: the nearest linked node in that direction (distance along
 * the arrow plus twice the sideways drift), else the next (→ ↓) or previous (← ↑) node in `order`, wrapping.
 */
export function stepFocus(
  from: string,
  key: ArrowKey,
  pos: Record<string, Point>,
  neighbours: Iterable<string>,
  order: string[],
): string | undefined {
  const a = pos[from]
  let best: string | undefined
  let bestScore = Infinity
  if (a) {
    for (const id of neighbours) {
      const b = pos[id]
      if (!b || id === from) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const along = key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy
      if (along <= 0) continue
      const score = along + 2 * Math.abs(key === "ArrowRight" || key === "ArrowLeft" ? dy : dx)
      if (score < bestScore || (score === bestScore && best !== undefined && id < best)) { best = id; bestScore = score }
    }
  }
  if (best || !order.length) return best
  const i = order.indexOf(from)
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1
  return order[(Math.max(i, step > 0 ? -1 : 0) + step + order.length) % order.length]
}

type GraphLike = { nodes: { path: string; label: string }[]; edges: { from: string; to: string }[] }

/**
 * Node paths a refresh touched: added or removed files, both ends of an added or removed link, renamed labels.
 * Empty on the first load (no `prev`), so only live updates flash.
 */
export function graphChanges(prev: GraphLike | null, next: GraphLike): Set<string> {
  const out = new Set<string>()
  if (!prev) return out
  const labels = new Map(prev.nodes.map((n) => [n.path, n.label]))
  const now = new Set(next.nodes.map((n) => n.path))
  for (const n of next.nodes) if (labels.get(n.path) !== n.label) out.add(n.path)
  for (const p of labels.keys()) if (!now.has(p)) out.add(p)
  const key = (e: { from: string; to: string }) => `${e.from}\u0000${e.to}`
  const before = new Set(prev.edges.map(key))
  const after = new Set(next.edges.map(key))
  for (const e of next.edges) if (!before.has(key(e))) out.add(e.from).add(e.to)
  for (const e of prev.edges) if (!after.has(key(e))) out.add(e.from).add(e.to)
  return out
}

export type LabelBox = { id: string; x: number; y: number; w: number; h: number }

/**
 * Greedy label collision pass: boxes come in priority order (selected, matches, then by degree); a label that
 * overlaps one already placed is hidden. `keep` ids are always placed. Flow coordinates, so it holds at any zoom.
 * ponytail: O(n²) over visible labels (~200 here); a grid bucket if graphs reach thousands of labels.
 */
export function hiddenLabels(boxes: LabelBox[], keep: Set<string> = new Set()): Set<string> {
  const placed: LabelBox[] = []
  const hidden = new Set<string>()
  const hit = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  for (const b of boxes) {
    if (!keep.has(b.id) && placed.some((p) => hit(p, b))) hidden.add(b.id)
    else placed.push(b)
  }
  return hidden
}
