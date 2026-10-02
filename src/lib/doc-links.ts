// Pure doc link graph (R056, no fs): resolved links between every .md file, derived from text, never stored.
// Self-check: node src/lib/doc-links.check.mts. Regexes and labels are copied from memory-graph.ts (pure libs
// never import values from each other), but here relative `./` and `../` targets are resolved.

export type DocNodeKind = 'doc' | 'adr' | 'task' | 'epic' | 'entry'
/** `status` / `owner` are set on task and epic nodes by GET /api/docs/graph, never by docNode(). */
export type DocNode = { id: string; kind: DocNodeKind; label: string; path: string; status?: string; owner?: string | null }
export type LinkKind = 'md' | 'wiki' | 'code' | 'id'
/** `context`: the sentence around the link (or the heading above it), set only when the link text is just the target. */
export type DocLink = { target: string; kind: LinkKind; line: number; text: string; context?: string }
/** One file as the graph needs it: its node and its raw (unresolved) links. core.ts caches this per file. */
export type DocItem = { node: DocNode; links: DocLink[] }
export type DocEdge = { from: string; to: string; line: number; text: string; context?: string }
export type BrokenLink = { from: string; target: string; line: number; text: string; kind: LinkKind }
/** Raw link target as written in a file → the file it resolves to (self-links included). Keyed by source path. */
export type ResolvedTargets = Record<string, Record<string, string>>
/** `broken`: md / wiki links that point nowhere. `stale`: backticked paths (`code`) to a file that doesn't exist. */
export type DocGraph = { nodes: DocNode[]; edges: DocEdge[]; broken: BrokenLink[]; stale: BrokenLink[]; targets: ResolvedTargets }
export type LinkRow = { path: string; kind: string; label: string; line: number; text: string; context?: string }

// Upper case only, whole tokens: "XT0651", "e2e" and "T0651a" don't match
const ID_RE = /(?<![A-Za-z0-9_-])(E\d+|T\d{3,}|R\d{3,}|ADR-\d+)(?![A-Za-z0-9_])/g
const ID_ONLY_RE = /^(E\d+|T\d{3,}|R\d{3,}|ADR-\d+)$/
const BACKTICK_MD_RE = /`([^`\s]+\.md)`/g
const LINK_MD_RE = /\[([^\]]*)\]\(\s*<?([^)\s>#]+\.md)(?:#[^)\s]*)?>?(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/g
const FENCE_RE = /^\s*(`{3,}|~{3,})/
const INLINE_CODE_RE = /(`+)[^`]*?\1/g

/** Targets are keyed decoded (`my%20doc.md` → `my doc.md`), as the client looks them up after marked encodes. */
const decode = (t: string) => { try { return decodeURI(t) } catch { return t } }
/** A source line as plain prose: list / heading / checkbox markers, link syntax, code ticks and emphasis removed. */
const plainLine = (l: string) => l
  .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '')
  .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/`|\*\*|__/g, '')
  .trim()

/** The sentence of `line` that holds `text`, minus a leading `text:`; the heading above when the line is only the link. */
function linkContext(line: string, text: string, heading: string): string {
  const sentence = plainLine(line).split(/(?<=[.!?])\s+/).find(s => s.includes(text)) ?? ''
  const rest = (sentence.startsWith(text) ? sentence.slice(text.length).replace(/^[\s:,;–—-]+/, '') : sentence).trim()
  return (/[A-Za-z]{3}/.test(rest.replace(text, '')) ? rest : heading).slice(0, 200)
}

/**
 * A target written as a template, never a file: `<slug>`, `{id}`, globs, `…` / `...`, and `T00N` / `NNN` / `XXX` /
 * `YYYY` tokens (`plans/tasks/T<NNN>-<slug>.md`, `docs/meetings/YYYY-MM-DD.md`). Skipped at extraction.
 */
const PLACEHOLDER_RE = /[<>{}*?…]|\.\.\.|(?:^|[^A-Za-z0-9])(?:[A-Z]?0+N|N{2,}|X{3,}|YYYY)(?![A-Za-z0-9])/
/**
 * Names that teach link syntax in specs (`[text](path.md)`, `[[name]]`, `[[wikilinks]]`, `docs/a/x.md`): the whole
 * file name is one of these, or the rest after an item id (`T001-x.md`, `ADR-001-title.md`). Only ever drops a miss,
 * so a real `x.md` still links. Never a `-` part of a longer name: `user-name.md` and `plan-b.md` are real misses.
 * `missing` is deliberately not here: e2e fixtures use it for a real broken link.
 */
const EXAMPLE_NAMES = new Set(['a', 'b', 'c', 'x', 'y', 'z', 'path', 'name', 'slug', 'title', 'foo', 'bar', 'wikilinks', 'example'])
export function isExampleTarget(target: string): boolean {
  const name = (target.split('/').pop() ?? '').replace(/\.md$/i, '').replace(/^(?:ADR-\d+|[TRE]\d+)-/, '')
  return EXAMPLE_NAMES.has(name.toLowerCase())
}

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

/** Inline markdown → plain text for a label: images and links keep their text, emphasis / code marks go. */
function plainText(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t: string, alias?: string) => alias ?? t)
    .replace(/(\*\*|\*|~~|`)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/(^|\W)(__|_)(\S(?:.*?\S)?)\2(?=\W|$)/g, '$1$3') // _em_, never snake_case
    .replace(/<[^>]+>/g, '')
    .trim()
}

/**
 * Classify a markdown file by path. Label = its H1 without the "ID: " prefix, else the file name. An H1 that reads as
 * a sentence (ends in . or !, like AGENTS.md's "See CLAUDE.md — this file mirrors it…") is prose, not a title.
 */
export function docNode(relPath: string, raw: string): DocNode {
  const p = normalizePath(relPath) ?? relPath
  const name = baseName(p)
  const heading = plainText(/^#\s+(.+?)\s*$/m.exec(raw)?.[1] ?? '')
  const h1 = /[^.][.!]$/.test(heading) ? '' : heading
  const label = (id: string) => h1.replace(new RegExp(`^${id}\\s*[:—–-]\\s*`), '') || name
  let m: RegExpExecArray | null
  if ((m = /^plans\/tasks\/(T\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'task', label: label(m[1]), path: p }
  if ((m = /^plans\/roadmap\/(R\d{3,})[^/]*\.md$/.exec(p))) return { id: m[1], kind: 'epic', label: label(m[1]), path: p }
  if ((m = /^memory\/entries\/(E\d+)[^/]*\.md$/.exec(p))) return { id: normalizeId(m[1]), kind: 'entry', label: label(m[1]), path: p }
  if ((m = /(?:^|\/)(ADR-\d+)[^/]*\.md$/.exec(p))) return { id: normalizeId(m[1]), kind: 'adr', label: label(m[1]), path: p }
  return { id: p, kind: 'doc', label: h1 || name, path: p }
}

/**
 * Links in `raw`, in order, with 1-based line numbers. Lines inside ``` / ~~~ fences and external URLs are skipped;
 * md and wiki links inside inline code spans too. Indented code blocks are not detected (nested lists look alike).
 */
export function extractLinks(raw: string, _fromPath?: string): DocLink[] {
  const links: DocLink[] = []
  let fence = '' // the opening marker while inside a fence
  let heading = ''
  raw.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const f = FENCE_RE.exec(l)?.[1]
    if (f && (!fence || (f[0] === fence[0] && f.length >= fence.length))) { fence = fence ? '' : f; return }
    if (fence) return
    const line = i + 1
    const from = links.length
    const prose = l.replace(INLINE_CODE_RE, m => ' '.repeat(m.length))
    for (const m of prose.matchAll(LINK_MD_RE)) {
      // text from the original line (same offsets): [`code`](x.md) keeps its label
      const text = l.slice(m.index + 1, m.index + 1 + m[1].length)
      if (!EXTERNAL_RE.test(m[2]) && !PLACEHOLDER_RE.test(m[2])) links.push({ target: decode(m[2]), kind: 'md', line, text: text || m[2] })
    }
    for (const m of prose.matchAll(WIKI_RE)) {
      const target = decode(m[1].trim())
      if (target && !EXTERNAL_RE.test(target) && !PLACEHOLDER_RE.test(target)) links.push({ target, kind: 'wiki', line, text: (m[2] ?? target).trim() })
    }
    for (const m of l.matchAll(BACKTICK_MD_RE)) {
      // a glob (`memory/entries/E*.md`) or a template (`E001-<slug>.md`) names a pattern, not a file
      if (!EXTERNAL_RE.test(m[1]) && !PLACEHOLDER_RE.test(m[1])) links.push({ target: decode(m[1]), kind: 'code', line, text: m[1] })
    }
    for (const m of l.matchAll(ID_RE)) {
      if (/^E0+$/.test(m[1])) continue // E0 is not an entry id
      links.push({ target: normalizeId(m[1]), kind: 'id', line, text: m[1] })
    }
    // a bare link (text = target) says nothing by itself: carry the sentence it sits in
    for (const k of links.slice(from)) if (k.text === k.target) {
      const context = linkContext(l, k.text, heading)
      if (context) k.context = context
    }
    if (/^#{1,6}\s/.test(l)) heading = plainLine(l)
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

/** Files named exactly `t` (case-insensitive, `.md` added when missing), anywhere in the repo. */
function bareHits(t: string, idx: PathIndex): string[] {
  const file = (/\.md$/i.test(t) ? t : `${t}.md`).toLowerCase()
  return (idx.byBase.get(baseName(file)) ?? []).filter(p => (p.split('/').pop() ?? '').toLowerCase() === file)
}

/**
 * The file a link points at, or null (broken). Paths: relative to the source folder, then root-relative.
 * An explicit `./` or `../` never falls back to the root. Wikilinks: by basename without `.md`, same folder first,
 * then the shortest path; [[T093]] / [[E1]] go to the item's file first. Ids: the item's file.
 * `target` is taken as written, already decoded (extractLinks decodes).
 * `kind` is inferred when left out: an id token → id, no `.md` → wiki, else a path.
 * Paths: a leading `@` (Claude include, `@docs/HLD.md`) is dropped. A backticked bare name (`MEMORY.md`) that is in
 * neither folder resolves when exactly one file in the repo has that name; an md link never does.
 */
export function resolveLink(target: string, fromPath: string, allPaths: readonly string[], kind?: LinkKind): string | null {
  const idx = indexOf(allPaths)
  const k = kind ?? (ID_ONLY_RE.test(target) ? 'id' : /\.md$/i.test(target) ? 'md' : 'wiki')
  if (k === 'id') return idx.byId.get(normalizeId(target)) ?? null

  if (k === 'wiki' && ID_ONLY_RE.test(target)) {
    const byId = idx.byId.get(normalizeId(target))
    if (byId) return byId
  }
  const t = k === 'wiki' ? target : target.replace(/^@(?=[^/@])/, '')
  const explicitRel = /^\.\.?\//.test(t)
  const from = normalizePath(fromPath) ?? fromPath
  const tryPath = (p: string) => {
    const cands = [p, /\.md$/i.test(p) ? null : `${p}.md`].filter((c): c is string => !!c)
    for (const c of cands) {
      const rel = t.startsWith('/') ? null : normalizePath(`${dirOf(from)}/${c}`)
      if (rel !== null && idx.set.has(rel)) return rel
      if (explicitRel) continue
      const abs = normalizePath(c)
      if (abs !== null && idx.set.has(abs)) return abs
    }
    return null
  }
  if (k !== 'wiki') {
    // a link must work as written (it does on GitHub too); a backticked mention only has to name the file
    const hits = k !== 'code' || t.includes('/') ? [] : bareHits(t, idx)
    return tryPath(t) ?? (hits.length === 1 ? hits[0] : null)
  }

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

/**
 * Resolve every item's links. One edge per from→to pair (first line wins), self-links dropped. Misses: md / wiki
 * links → broken, backticked paths → stale (a mention of a moved or planned file, not a link).
 * Not misses: a target that exists among `otherPaths` (files outside the graph, e.g. `.claude/**`; no node, no edge),
 * a backticked bare name several files share (it exists, just not one file), and a syntax example (`isExampleTarget`).
 */
export function buildDocGraph(items: DocItem[], otherPaths: readonly string[] = []): DocGraph {
  const allPaths = items.map(i => i.node.path)
  const known = [...allPaths, ...otherPaths]
  const exists = (l: DocLink, from: string) => resolveLink(l.target, from, known, l.kind) !== null
    || (l.kind === 'code' && !l.target.includes('/') && bareHits(l.target, indexOf(known)).length > 0)
  const edges = new Map<string, DocEdge>()
  const broken = new Map<string, BrokenLink>()
  const stale = new Map<string, BrokenLink>()
  const targets: ResolvedTargets = {}
  for (const { node, links } of items) {
    for (const l of links) {
      const to = resolveLink(l.target, node.path, allPaths, l.kind)
      if (to !== null) (targets[node.path] ??= {})[l.target] ??= to
      if (to === node.path) continue
      if (to === null) {
        // an id with no file (T999, a typo) is just text, not a broken link
        if (l.kind === 'id' || isExampleTarget(l.target) || exists(l, node.path)) continue
        const key = `${node.path}\u0000${l.target}`
        const misses = l.kind === 'code' ? stale : broken
        if (!misses.has(key)) misses.set(key, { from: node.path, target: l.target, line: l.line, text: l.text, kind: l.kind })
        continue
      }
      const key = `${node.path}\u0000${to}`
      if (!edges.has(key)) edges.set(key, { from: node.path, to, line: l.line, text: l.text, ...(l.context && { context: l.context }) })
    }
  }
  return { nodes: items.map(i => i.node), edges: [...edges.values()], broken: [...broken.values()], stale: [...stale.values()], targets }
}

export type TargetRow = { path: string; kind: DocNodeKind; id: string; label: string }

/**
 * Links out of, into, broken and stale paths in one file; null when the path is not in the graph.
 * `targets` maps each raw target written in the file (`../b/y.md`, `DOMAIN_MAP`, `T093`) to its node, so a client
 * can open a clicked link without resolving paths itself. A target in both `targets` and `broken` resolved.
 */
export function docLinks(graph: DocGraph, path: string): { out: LinkRow[]; in: LinkRow[]; broken: LinkRow[]; stale: LinkRow[]; targets: Record<string, TargetRow> } | null {
  const p = normalizePath(path) ?? path
  const byPath = new Map(graph.nodes.map(n => [n.path, n]))
  if (!byPath.has(p)) return null
  const row = (other: string, e: DocEdge): LinkRow => {
    const n = byPath.get(other)
    return { path: other, kind: n?.kind ?? 'doc', label: n?.label ?? baseName(other), line: e.line, text: e.text, ...(e.context && { context: e.context }) }
  }
  const miss = (b: BrokenLink): LinkRow => ({ path: b.target, kind: b.kind, label: b.target, line: b.line, text: b.text })
  return {
    out: graph.edges.filter(e => e.from === p).map(e => row(e.to, e)),
    in: graph.edges.filter(e => e.to === p).map(e => row(e.from, e)),
    broken: graph.broken.filter(b => b.from === p).map(miss),
    stale: graph.stale.filter(b => b.from === p).map(miss),
    targets: Object.fromEntries(Object.entries(graph.targets[p] ?? {}).map(([t, to]) => {
      const n = byPath.get(to)
      return [t, { path: to, kind: n?.kind ?? 'doc', id: n?.id ?? to, label: n?.label ?? baseName(to) }]
    })),
  }
}

/**
 * Footer for vibedoc_read_doc (T096): the files a doc links to and is linked from, each named so an agent can
 * pass it straight to a tool (tasks, epics, entries, ADRs by id; docs by path). Empty string when no links.
 */
export function formatRelatedFiles(links: { out: LinkRow[]; in: LinkRow[]; broken: LinkRow[]; stale?: LinkRow[] } | null, cap = 10): string {
  if (!links) return ''
  const name = (r: LinkRow) => idOfPath(r.path) ?? r.path
  const line = (label: string, items: string[]) => {
    if (!items.length) return []
    const more = items.length > cap ? ` (+${items.length - cap} more)` : ''
    return [`${label}: ${items.slice(0, cap).join(' · ')}${more}`]
  }
  const body = [
    ...line('Links to', links.out.map(name)),
    ...line('Linked from', links.in.map(r => `${name(r)} (L${r.line})`)),
    ...line('Broken', links.broken.map(r => `${r.path} (L${r.line})`)),
    ...line('Stale paths', (links.stale ?? []).map(r => `${r.path} (L${r.line})`)),
  ]
  if (!body.length) return ''
  return ['## Related files', ...body, 'Read with vibedoc_read_doc, or several at once with vibedoc_get_context { paths }.'].join('\n')
}
