// Pure doc link graph (R056, no fs): resolved links between every .md file, derived from text, never stored.
// Self-check: node src/lib/doc-links.check.mts. Regexes and labels are copied from memory-graph.ts (pure libs
// never import values from each other), but here relative `./` and `../` targets are resolved.

export type DocNodeKind = 'doc' | 'adr' | 'task' | 'epic' | 'entry'
export type DocNode = { id: string; kind: DocNodeKind; label: string; path: string }
export type LinkKind = 'md' | 'wiki' | 'code' | 'id'
export type DocLink = { target: string; kind: LinkKind; line: number; text: string }
/** One file as the graph needs it: its node and its raw (unresolved) links. core.ts caches this per file. */
export type DocItem = { node: DocNode; links: DocLink[] }
export type DocEdge = { from: string; to: string; line: number; text: string }
export type BrokenLink = { from: string; target: string; line: number; text: string; kind: LinkKind }
/** Raw link target as written in a file → the file it resolves to (self-links included). Keyed by source path. */
export type ResolvedTargets = Record<string, Record<string, string>>
export type DocGraph = { nodes: DocNode[]; edges: DocEdge[]; broken: BrokenLink[]; targets: ResolvedTargets }
export type LinkRow = { path: string; kind: string; label: string; line: number; text: string }

// Upper case only, whole tokens: "XT0651", "e2e" and "T0651a" don't match
const ID_RE = /(?<![A-Za-z0-9_-])(E\d+|T\d{3,}|R\d{3,}|ADR-\d+)(?![A-Za-z0-9_])/g
const ID_ONLY_RE = /^(E\d+|T\d{3,}|R\d{3,}|ADR-\d+)$/
const BACKTICK_MD_RE = /`([^`\s]+\.md)`/g
const LINK_MD_RE = /\[([^\]]*)\]\(\s*<?([^)\s>#]+\.md)(?:#[^)\s]*)?>?\s*\)/g
const WIKI_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

const pad3 = (n: string) => String(Number(n)).padStart(3, '0')

/** "E1" → "E001", "ADR-4" → "ADR-004"; task and roadmap ids are already padded. */
function normalizeId(id: string): string {
  if (id.startsWith('ADR-')) return `ADR-${pad3(id.slice(4))}`
  if (id.startsWith('E')) return `E${pad3(id.slice(1))}`
  return id
}

/** Posix-normalize: backslashes, `.` and `..` segments, leading `./` or `/`. Escaping above the root → null. */
function normalizePath(p: string): string | null {
  const out: string[] = []
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') { if (!out.length) return null; out.pop() } else out.push(seg)
  }
  return out.join('/')
}

const dirOf = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
const baseName = (p: string) => (p.split('/').pop() ?? p).replace(/\.md$/i, '')

/** The item id a file stands for (T093, R056, E001, ADR-004), from its path; null for a plain doc. */
function idOfPath(p: string): string | null {
  const m = /^plans\/tasks\/(T\d{3,})[^/]*\.md$/.exec(p) ?? /^plans\/roadmap\/(R\d{3,})[^/]*\.md$/.exec(p)
    ?? /^memory\/entries\/(E\d+)[^/]*\.md$/.exec(p) ?? /(?:^|\/)(ADR-\d+)[^/]*\.md$/.exec(p)
  return m ? normalizeId(m[1]) : null
}

/** Classify a markdown file by path. Label = its H1 without the "ID: " prefix, else the file name. */
export function docNode(relPath: string, raw: string): DocNode {
  const p = normalizePath(relPath) ?? relPath
  const name = baseName(p)
  const h1 = /^#\s+(.+?)\s*$/m.exec(raw)?.[1] ?? ''
  const label = (id: string) => h1.replace(new RegExp(`^${id}\\s*[:—–-]\\s*`), '') || name
  let m: RegExpExecArray | null
  if ((m = /^plans\/tasks\/(T\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'task', label: label(m[1]), path: p }
  if ((m = /^plans\/roadmap\/(R\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'epic', label: label(m[1]), path: p }
  if ((m = /^memory\/entries\/(E\d+)[^/]*\.md$/.exec(p))) return { id: normalizeId(m[1]), kind: 'entry', label: label(m[1]), path: p }
  if ((m = /(?:^|\/)(ADR-\d+)[^/]*\.md$/.exec(p))) return { id: normalizeId(m[1]), kind: 'adr', label: label(m[1]), path: p }
  return { id: p, kind: 'doc', label: h1 || name, path: p }
}

/** Links in `raw`, in order, with 1-based line numbers. Lines inside ``` fences and external URLs are skipped. */
export function extractLinks(raw: string, _fromPath?: string): DocLink[] {
  const links: DocLink[] = []
  let inFence = false
  raw.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return }
    if (inFence) return
    const line = i + 1
    for (const m of l.matchAll(LINK_MD_RE)) {
      if (!EXTERNAL_RE.test(m[2])) links.push({ target: m[2], kind: 'md', line, text: m[1] || m[2] })
    }
    for (const m of l.matchAll(WIKI_RE)) {
      const target = m[1].trim()
      if (target && !EXTERNAL_RE.test(target)) links.push({ target, kind: 'wiki', line, text: (m[2] ?? target).trim() })
    }
    for (const m of l.matchAll(BACKTICK_MD_RE)) {
      if (!EXTERNAL_RE.test(m[1])) links.push({ target: m[1], kind: 'code', line, text: m[1] })
    }
    for (const m of l.matchAll(ID_RE)) {
      if (/^E0+$/.test(m[1])) continue // E0 is not an entry id
      links.push({ target: normalizeId(m[1]), kind: 'id', line, text: m[1] })
    }
  })
  return links
}

type PathIndex = { set: Set<string>; byBase: Map<string, string[]>; byId: Map<string, string> }
const indexCache = new WeakMap<readonly string[], PathIndex>()

function indexOf(allPaths: readonly string[]): PathIndex {
  let idx = indexCache.get(allPaths)
  if (idx) return idx
  idx = { set: new Set(allPaths), byBase: new Map(), byId: new Map() }
  for (const p of allPaths) {
    const b = baseName(p).toLowerCase()
    idx.byBase.set(b, [...(idx.byBase.get(b) ?? []), p])
    const id = idOfPath(p)
    if (id && !idx.byId.has(id)) idx.byId.set(id, p)
  }
  indexCache.set(allPaths, idx)
  return idx
}

/**
 * The file a link points at, or null (broken). Paths: relative to the source folder, then root-relative.
 * Wikilinks: by basename without `.md`, same folder first, then the shortest path. Ids: the item's file.
 * `kind` is inferred when left out: an id token → id, no `.md` → wiki, else a path.
 */
export function resolveLink(target: string, fromPath: string, allPaths: readonly string[], kind?: LinkKind): string | null {
  const idx = indexOf(allPaths)
  const k = kind ?? (ID_ONLY_RE.test(target) ? 'id' : /\.md$/i.test(target) ? 'md' : 'wiki')
  if (k === 'id') return idx.byId.get(normalizeId(target)) ?? null

  let t = target
  try { t = decodeURI(target) } catch { /* keep the raw target */ }
  const from = normalizePath(fromPath) ?? fromPath
  const tryPath = (p: string) => {
    const cands = [p, /\.md$/i.test(p) ? null : `${p}.md`].filter((c): c is string => !!c)
    for (const c of cands) {
      const rel = t.startsWith('/') ? null : normalizePath(`${dirOf(from)}/${c}`)
      if (rel !== null && idx.set.has(rel)) return rel
      const abs = normalizePath(c)
      if (abs !== null && idx.set.has(abs)) return abs
    }
    return null
  }
  if (k !== 'wiki') return tryPath(t)

  // wikilink: an exact path first ([[docs/HLD]]), then by basename
  const exact = t.includes('/') ? tryPath(t) : null
  if (exact) return exact
  const name = baseName(t).toLowerCase()
  const suffix = t.includes('/') ? `/${t.replace(/\.md$/i, '').toLowerCase()}.md` : null
  const hits = (idx.byBase.get(name) ?? []).filter(p => !suffix || `/${p.toLowerCase()}`.endsWith(suffix))
  if (!hits.length) return null
  const dir = dirOf(from)
  return hits.find(p => dirOf(p) === dir)
    ?? [...hits].sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length || a.localeCompare(b))[0]
}

/** Resolve every item's links. One edge per from→to pair (first line wins), self-links dropped, misses → broken. */
export function buildDocGraph(items: DocItem[]): DocGraph {
  const allPaths = items.map(i => i.node.path)
  const edges = new Map<string, DocEdge>()
  const broken = new Map<string, BrokenLink>()
  const targets: ResolvedTargets = {}
  for (const { node, links } of items) {
    for (const l of links) {
      const to = resolveLink(l.target, node.path, allPaths, l.kind)
      if (to !== null) (targets[node.path] ??= {})[l.target] ??= to
      if (to === node.path) continue
      if (to === null) {
        // an id with no file (T999, a typo) is just text, not a broken link
        if (l.kind === 'id') continue
        const key = `${node.path}\u0000${l.target}`
        if (!broken.has(key)) broken.set(key, { from: node.path, target: l.target, line: l.line, text: l.text, kind: l.kind })
        continue
      }
      const key = `${node.path}\u0000${to}`
      if (!edges.has(key)) edges.set(key, { from: node.path, to, line: l.line, text: l.text })
    }
  }
  return { nodes: items.map(i => i.node), edges: [...edges.values()], broken: [...broken.values()], targets }
}

export type TargetRow = { path: string; kind: DocNodeKind; id: string; label: string }

/**
 * Links out of, into and broken in one file; null when the path is not in the graph.
 * `targets` maps each raw target written in the file (`../b/y.md`, `DOMAIN_MAP`, `T093`) to its node, so a client
 * can open a clicked link without resolving paths itself. A target in both `targets` and `broken` resolved.
 */
export function docLinks(graph: DocGraph, path: string): { out: LinkRow[]; in: LinkRow[]; broken: LinkRow[]; targets: Record<string, TargetRow> } | null {
  const p = normalizePath(path) ?? path
  const byPath = new Map(graph.nodes.map(n => [n.path, n]))
  if (!byPath.has(p)) return null
  const row = (other: string, line: number, text: string): LinkRow => {
    const n = byPath.get(other)
    return { path: other, kind: n?.kind ?? 'doc', label: n?.label ?? baseName(other), line, text }
  }
  return {
    out: graph.edges.filter(e => e.from === p).map(e => row(e.to, e.line, e.text)),
    in: graph.edges.filter(e => e.to === p).map(e => row(e.from, e.line, e.text)),
    broken: graph.broken.filter(b => b.from === p).map(b => ({ path: b.target, kind: b.kind, label: b.target, line: b.line, text: b.text })),
    targets: Object.fromEntries(Object.entries(graph.targets[p] ?? {}).map(([t, to]) => {
      const n = byPath.get(to)
      return [t, { path: to, kind: n?.kind ?? 'doc', id: n?.id ?? to, label: n?.label ?? baseName(to) }]
    })),
  }
}
