// Pure memory link graph (R053, no fs): links are inferred from text, never stored. Self-check: node src/lib/memory-graph.check.mts
// Outgoing edges come from entry text; incoming edges from task, roadmap and doc files that mention an entry id.

export type NodeKind = 'entry' | 'task' | 'epic' | 'adr' | 'doc' | 'spec' // 'spec': doc-links nodes (R066); fileNode() never makes one
export type GraphNode = { id: string; kind: NodeKind; label: string; path: string }
export type GraphEdge = { from: string; to: string } // from mentions to
export type MemoryGraph = { nodes: GraphNode[]; edges: GraphEdge[] }
/** A node plus the text scanned for its refs. */
export type GraphItem = GraphNode & { text: string }

// Upper case only, whole tokens: "XT0651", "e2e" and "T0651a" don't match
const ID_RE = /(?<![A-Za-z0-9_-])(E\d+|T\d{3,}|R\d{3,}|ADR-\d+)(?![A-Za-z0-9_])/g
const BACKTICK_MD_RE = /`([^`\s]+\.md)`/g
const LINK_MD_RE = /\]\(\s*<?([^)\s>#]+\.md)(?:#[^)\s]*)?>?\s*\)/g

const pad3 = (n: string) => String(Number(n)).padStart(3, '0')

/** "E1" → "E001", "ADR-4" → "ADR-004"; task and roadmap ids are already padded. */
function normalizeId(id: string): string {
  if (id.startsWith('ADR-')) return `ADR-${pad3(id.slice(4))}`
  if (id.startsWith('E')) return `E${pad3(id.slice(1))}`
  return id
}

const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '')

/** Item ids (E/T/R/ADR) and `*.md` paths (in backticks or as link targets) mentioned in `text`, deduplicated. */
export function extractRefs(text: string): { ids: string[]; paths: string[] } {
  const ids = new Set<string>()
  for (const m of text.matchAll(ID_RE)) {
    if (/^E0+$/.test(m[1])) continue // E0 is not an entry id
    ids.add(normalizeId(m[1]))
  }
  const paths = new Set<string>()
  for (const re of [BACKTICK_MD_RE, LINK_MD_RE]) {
    for (const m of text.matchAll(re)) {
      if (/^[a-z]+:\/\//i.test(m[1])) continue // external URL
      paths.add(normalizePath(m[1]))
    }
  }
  return { ids: [...ids], paths: [...paths] }
}

/** Classify a non-entry markdown file by path. Label = its H1 without the "ID: " prefix, else the file name. */
export function fileNode(relPath: string, raw: string): GraphNode {
  const p = normalizePath(relPath)
  const name = p.split('/').pop() ?? p
  const h1 = /^#\s+(.+?)\s*$/m.exec(raw)?.[1] ?? ''
  const label = (id: string) => h1.replace(new RegExp(`^${id}\\s*[:—–-]\\s*`), '') || name.replace(/\.md$/, '')
  let m: RegExpExecArray | null
  if ((m = /^plans\/tasks\/(T\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'task', label: label(m[1]), path: p }
  if ((m = /^plans\/roadmap\/(R\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'epic', label: label(m[1]), path: p }
  if ((m = /(?:^|\/)(ADR-\d+)[^/]*\.md$/.exec(p))) {
    const id = normalizeId(m[1])
    return { id, kind: 'adr', label: label(m[1]), path: p }
  }
  return { id: p, kind: 'doc', label: h1 || name.replace(/\.md$/, ''), path: p }
}

/**
 * Resolve refs into a graph. Unresolved refs, self-links and duplicate edges are dropped.
 * Nodes = every entry + every other item that touches an entry.
 */
export function buildGraph(entries: GraphItem[], others: GraphItem[]): MemoryGraph {
  const all = [...entries, ...others]
  const byId = new Map(all.map(n => [n.id, n]))
  const byPath = new Map(all.map(n => [n.path, n]))
  const entryIds = new Set(entries.map(e => e.id))
  const edges = new Map<string, GraphEdge>()
  const add = (from: string, to: string) => { if (from !== to) edges.set(`${from}\u0000${to}`, { from, to }) }

  for (const e of entries) {
    const { ids, paths } = extractRefs(e.text)
    for (const id of ids) if (byId.has(id)) add(e.id, id)
    for (const p of paths) { const n = byPath.get(p); if (n) add(e.id, n.id) }
  }
  // incoming: other files that mention an entry id (not the whole doc-to-doc graph)
  for (const o of others) {
    for (const id of extractRefs(o.text).ids) if (entryIds.has(id)) add(o.id, id)
  }

  const touched = new Set(entryIds)
  for (const e of edges.values()) { touched.add(e.from); touched.add(e.to) }
  const nodes = all.filter(n => touched.has(n.id)).map(({ text: _, ...n }) => n)
  return { nodes, edges: [...edges.values()] }
}

/** One entry, its direct neighbours and the edges between it and them. Unknown id → empty graph. */
export function neighbourhood(graph: MemoryGraph, id: string): MemoryGraph {
  if (!graph.nodes.some(n => n.id === id)) return { nodes: [], edges: [] }
  const edges = graph.edges.filter(e => e.from === id || e.to === id)
  const keep = new Set([id, ...edges.flatMap(e => [e.from, e.to])])
  return { nodes: graph.nodes.filter(n => keep.has(n.id)), edges }
}

/**
 * "Links: …" / "Linked from: …" lines for one entry (vibedoc_get_entries). A line with nothing is left out;
 * each is capped at `cap` items plus "+N more", so a hub entry stays short.
 */
export function formatEntryLinks(graph: MemoryGraph, id: string, cap = 10): string[] {
  const line = (label: string, ids: string[]) => {
    if (!ids.length) return []
    const more = ids.length > cap ? `, +${ids.length - cap} more` : ''
    return [`${label}: ${ids.slice(0, cap).join(', ')}${more}`]
  }
  return [
    ...line('Links', graph.edges.filter(e => e.from === id).map(e => e.to)),
    ...line('Linked from', graph.edges.filter(e => e.to === id).map(e => e.from)),
  ]
}

export const GRAPH_COL_W = 240
export const GRAPH_ROW_H = 48
/** Column per kind: epics and tasks left of the entries, ADRs and docs right of them. */
const GRAPH_COL: Record<NodeKind, number> = { epic: -2, task: -1, entry: 0, adr: 1, doc: 2, spec: 2 }

/**
 * Deterministic positions for the graph view (no layout library, no saved positions): entries stacked in the
 * centre column (sorted by type, then id), every other node in its kind's column at the average y of the
 * entries it links with, pushed down to keep one row of space. Same graph → same positions on every load.
 */
export function graphLayout(graph: MemoryGraph, entryType: Record<string, string> = {}): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {}
  const num = (id: string) => Number(id.replace(/\D/g, '')) || 0
  const entries = graph.nodes.filter(n => n.kind === 'entry')
    .sort((a, b) => (entryType[a.id] ?? '').localeCompare(entryType[b.id] ?? '') || num(a.id) - num(b.id))
  entries.forEach((e, i) => { pos[e.id] = { x: 0, y: i * GRAPH_ROW_H } })

  const neighbourYs = new Map<string, number[]>()
  for (const { from, to } of graph.edges) {
    for (const [other, entry] of [[from, to], [to, from]]) {
      if (pos[entry] && !pos[other]) neighbourYs.set(other, [...(neighbourYs.get(other) ?? []), pos[entry].y])
    }
  }
  for (const kind of ['epic', 'task', 'adr', 'doc'] as const) {
    const col = graph.nodes.filter(n => n.kind === kind).map(n => {
      const ys = neighbourYs.get(n.id) ?? [0]
      return { id: n.id, want: ys.reduce((a, b) => a + b, 0) / ys.length }
    }).sort((a, b) => a.want - b.want || a.id.localeCompare(b.id, 'en', { numeric: true }))
    let next = -Infinity
    for (const { id, want } of col) {
      const y = Math.max(want, next)
      pos[id] = { x: GRAPH_COL[kind] * GRAPH_COL_W, y }
      next = y + GRAPH_ROW_H
    }
  }
  return pos
}
