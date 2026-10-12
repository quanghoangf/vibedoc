// Diagrams derived from project data (R097), never stored: the graph is built from the tasks on read and drawn as
// Mermaid source, so the authored diagrams' theme and viewer (R096) apply. Pure: `node src/lib/item-diagrams.check.mts`.

export interface DiagramTask { id: string; title: string; status: string; dependsOn: string }
export interface DepNode { id: string; title: string; status: string | null }
/** null status = a dependency id with no task file. Edges run dependency → dependent (left to right). */
export interface DepGraph { nodes: DepNode[]; edges: [string, string][]; more: number }

export const DEP_CAP = 12

/** Every `T\d+` in a free-text "Depends on" line (same rule as work-queue `depIds`; inlined so node can run this file). */
export function depIdsOf(dependsOn: string): string[] {
  return [...new Set((dependsOn.match(/\bT\d+\b/gi) ?? []).map((d) => d.toUpperCase()))]
}

/**
 * A task's neighbourhood: what it waits on (two hops up), what waits on it (one hop down), at most `cap` nodes.
 * ponytail: fixed depth + cap keeps a long chain readable; the full picture is /board's By epic view.
 * Null when the task has neither dependencies nor dependents.
 */
export function taskNeighbourhood(id: string, tasks: DiagramTask[], cap = DEP_CAP): DepGraph | null {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const focus = byId.get(id)
  if (!focus) return null
  const up = (tid: string) => depIdsOf(byId.get(tid)?.dependsOn ?? "").filter((d) => d !== tid)
  const down = (tid: string) => tasks.filter((t) => t.id !== tid && depIdsOf(t.dependsOn).includes(tid)).map((t) => t.id)
  const first = up(id), dependents = down(id)
  if (first.length === 0 && dependents.length === 0) return null
  const second = first.flatMap(up)
  const wanted = [id, ...first, ...dependents, ...second]
  const seen = [...new Set(wanted)]
  const kept = seen.slice(0, cap)
  const keep = new Set(kept)
  const nodes = kept.map((nid) => {
    const t = byId.get(nid)
    return { id: nid, title: t?.title ?? "", status: t?.status ?? null }
  })
  const edges: [string, string][] = []
  for (const n of kept) for (const d of up(n)) if (keep.has(d)) edges.push([d, n])
  return { nodes, edges, more: seen.length - kept.length }
}

const GLYPH: Record<string, string> = { todo: "○", "in-progress": "◐", review: "◑", blocked: "⊘", paused: "⏸", done: "✓", cancelled: "✕" }
const MAX_TITLE = 32

/** Text inside a Mermaid `["…"]` label: quotes and angle brackets as entities, long titles cut. */
function label(s: string): string {
  const cut = s.length > MAX_TITLE ? s.slice(0, MAX_TITLE - 1).trimEnd() + "…" : s
  return cut.replace(/&/g, "#amp;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;")
}

/**
 * `flowchart LR` source: one node per task (`T001["✓ T001 · title"]`, the glyph so status isn't colour only),
 * class `st-<status>` (styled in globals.css), the focus task `accent`, a missing dependency `st-missing`.
 */
export function depGraphMermaid(g: DepGraph, focusId: string): string {
  const lines = ["flowchart LR"]
  for (const n of g.nodes) {
    const text = n.status === null ? `${n.id} · ?` : `${GLYPH[n.status] ?? "○"} ${n.id} · ${label(n.title)}`
    lines.push(`  ${n.id}["${text}"]`)
  }
  for (const [a, b] of g.edges) lines.push(`  ${a} --> ${b}`)
  if (g.more > 0) lines.push(`  more["+${g.more} more"]`, `  ${focusId} -.- more`)
  for (const n of g.nodes) lines.push(`  class ${n.id} ${n.id === focusId ? "accent" : n.status === null ? "st-missing" : `st-${n.status}`}`)
  return lines.join("\n")
}
