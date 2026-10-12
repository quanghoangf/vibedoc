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
function label(s: string, max = MAX_TITLE): string {
  const cut = s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s
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

export type ScenarioState = 'passed' | 'failed' | 'unproven'
export interface EpicScenario { id: string; name: string; status: ScenarioState }
export interface EpicTask extends DiagramTask { covers: string[] }
export interface EpicGraph { tasks: DepNode[]; scenarios: (EpicScenario & { covered: boolean })[]; deps: [string, string][]; covers: [string, string][] }

/** An epic's tasks (cancelled ones dropped, missing files skipped), their dependency edges inside the epic, and which scenario each covers. */
export function epicGraph(taskIds: string[], tasks: EpicTask[], scenarios: EpicScenario[]): EpicGraph {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const own = taskIds.map((id) => byId.get(id)).filter((t): t is EpicTask => !!t && t.status !== 'cancelled')
  const ids = new Set(own.map((t) => t.id))
  const scIds = new Set(scenarios.map((s) => s.id))
  const deps: [string, string][] = []
  const covers: [string, string][] = []
  for (const t of own) {
    for (const d of depIdsOf(t.dependsOn)) if (d !== t.id && ids.has(d)) deps.push([d, t.id])
    for (const s of t.covers) if (scIds.has(s)) covers.push([t.id, s])
  }
  const covered = new Set(covers.map(([, s]) => s))
  return {
    tasks: own.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    scenarios: scenarios.map((s) => ({ ...s, covered: covered.has(s.id) })),
    deps, covers,
  }
}

const SC_GLYPH: Record<ScenarioState, string> = { passed: '✓', failed: '✕', unproven: '?' }

/**
 * `flowchart TB`: tasks in dependency order top to bottom, the scenarios (stadium shapes, `S…` ids) below them, a
 * dotted edge from each task to every scenario it covers. Top to bottom and no subgraph boxes: the epic sheet is a
 * narrow pane, and width is what keeps 13px labels readable. Scenario classes `sc-passed|failed|unproven`, `sc-uncovered` when no task covers it.
 */
export function epicGraphMermaid(g: EpicGraph): string {
  const lines = ['flowchart TB']
  for (const n of g.tasks) lines.push(`  ${n.id}["${GLYPH[n.status ?? ''] ?? '○'} ${n.id} · ${label(n.title)}"]`)
  for (const s of g.scenarios) lines.push(`  ${s.id}(["${SC_GLYPH[s.status]} ${s.id} · ${label(s.name)}"])`)
  for (const [a, b] of g.deps) lines.push(`  ${a} --> ${b}`)
  for (const [t, s] of g.covers) lines.push(`  ${t} -.-> ${s}`)
  for (const n of g.tasks) lines.push(`  class ${n.id} st-${n.status}`)
  for (const s of g.scenarios) lines.push(`  class ${s.id} sc-${s.covered ? s.status : 'uncovered'}`)
  return lines.join('\n')
}

export interface LinkedFile { path: string; label: string; id: string; direction: 'in' | 'out' | 'both' }
export const LINK_CAP = 8
// the side panel is 18rem: two short labels side by side fit at 75%
const LINK_TITLE = 20

/**
 * A doc's links as `flowchart TB` (it lives in an 18rem column): files linking to it above, the doc in the middle
 * (the accent), files it links to below (`<-->` when both ways), broken links dashed below. At most `cap` per side, the rest
 * a "+N more" node. `targets` maps each clickable node id to its file path, or "more" for the overflow nodes.
 */
export function docLinkMermaid(selfLabel: string, files: LinkedFile[], broken: string[], cap = LINK_CAP): { source: string; targets: Record<string, string> } {
  const left = files.filter((f) => f.direction === 'in')
  const right = files.filter((f) => f.direction !== 'in')
  const lines = ['flowchart TB', `  self["${label(selfLabel, LINK_TITLE)}"]`]
  const targets: Record<string, string> = {}
  const text = (f: LinkedFile) => label(f.id !== f.path ? `${f.id} · ${f.label}` : f.label, LINK_TITLE)
  left.slice(0, cap).forEach((f, i) => { lines.push(`  in${i}["${text(f)}"] --> self`); targets[`in${i}`] = f.path })
  right.slice(0, cap).forEach((f, i) => { lines.push(`  self ${f.direction === 'both' ? '<-->' : '-->'} out${i}["${text(f)}"]`); targets[`out${i}`] = f.path })
  broken.slice(0, Math.max(0, cap - right.length)).forEach((b, i) => lines.push(`  self -.-> broken${i}["${label(b.split('/').pop() ?? b, LINK_TITLE)}"]`, `  class broken${i} st-missing`))
  const moreIn = left.length - cap, moreOut = right.length + broken.length - cap
  if (moreIn > 0) { lines.push(`  morein["+${moreIn} more"] -.- self`); targets.morein = 'more' }
  if (moreOut > 0) { lines.push(`  self -.- moreout["+${moreOut} more"]`); targets.moreout = 'more' }
  lines.push('  class self accent')
  return { source: lines.join('\n'), targets }
}
