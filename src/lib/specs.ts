// Pure capability specs (R066, no fs): `docs/specs/<capability>.md`, OpenSpec-style headings, nothing mandatory.
// `### Requirement: <name>` + a SHALL/MUST sentence, then `#### Scenario: <name>` with `- WHEN …` / `- THEN …` bullets.
// Self-check: node src/lib/specs.check.mts

export type SpecScenario = { name: string; text: string }
export type SpecRequirement = { name: string; text: string; scenarios: SpecScenario[] }
export type Spec = { capability: string; title: string; purpose: string; requirements: SpecRequirement[] }

const SPEC_PATH_RE = /^docs\/specs\/([^/]+)\.md$/

/** `docs/specs/<slug>.md`, no subfolders. */
export function isSpecPath(p: string): boolean {
  return SPEC_PATH_RE.test(p.replace(/\\/g, '/').replace(/^\.?\//, ''))
}

/** Lines inside ``` fences, so an example requirement quoted in a code block is never taken for a real one. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

const join = (ls: string[]) => ls.join('\n').trim()

/** Title = H1, purpose = the `## Purpose` section (else the prose before the first `##`), then requirements + scenarios. */
export function parseSpec(path: string, raw: string): Spec {
  const p = path.replace(/\\/g, '/').replace(/^\.?\//, '')
  const capability = SPEC_PATH_RE.exec(p)?.[1] ?? (p.split('/').pop() ?? p).replace(/\.md$/i, '')
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const code = fenced(lines)
  let title = ''
  const intro: string[] = []
  const purpose: string[] = []
  const requirements: SpecRequirement[] = []
  let req: { name: string; text: string[]; scenarios: { name: string; text: string[] }[] } | null = null
  let scenario: { name: string; text: string[] } | null = null
  let section: 'intro' | 'purpose' | 'other' | 'req' | 'scenario' = 'intro'
  const flush = () => {
    if (req) requirements.push({ name: req.name, text: join(req.text), scenarios: req.scenarios.map(s => ({ name: s.name, text: join(s.text) })) })
    req = null
    scenario = null
  }
  lines.forEach((l, i) => {
    const h = code[i] ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l)
    if (h) {
      const depth = h[1].length
      const text = h[2]
      let m: RegExpExecArray | null
      if (depth === 1 && !title) { title = text; return }
      if (depth === 3 && (m = /^Requirement:\s*(.+)$/i.exec(text))) {
        flush()
        req = { name: m[1].trim(), text: [], scenarios: [] }
        section = 'req'
        return
      }
      if (depth === 4 && req && (m = /^Scenario:\s*(.+)$/i.exec(text))) {
        scenario = { name: m[1].trim(), text: [] }
        req.scenarios.push(scenario)
        section = 'scenario'
        return
      }
      // a heading at the requirement's level or above ends it; a deeper non-scenario heading stays inside
      if (depth <= 3) {
        flush()
        section = depth === 2 && /^purpose$/i.test(text) ? 'purpose' : 'other'
        return
      }
    }
    if (section === 'intro') intro.push(l)
    else if (section === 'purpose') purpose.push(l)
    else if (section === 'req') req?.text.push(l)
    else if (section === 'scenario') scenario?.text.push(l)
  })
  flush()
  return { capability, title: title || capability, purpose: join(purpose) || join(intro), requirements }
}

/** `**Specs:** board-views, memory` on an epic → capability slugs (lower case, comma/space separated, `—` = none). */
export function parseSpecSlugs(v: string | undefined): string[] {
  return [...new Set((v ?? '').toLowerCase().split(/[,\s]+/).filter(s => /^[a-z0-9][a-z0-9._-]*$/.test(s)))]
}

export type RelatedSpecGroup = { capability: string; title: string; names: string[] }
const RELATED_SPEC_MAX_LINES = 15

/**
 * "## Related spec" for a task: per spec its path line and requirement names (no bodies), at most ~15 requirement
 * lines in all; '' when there are no groups.
 */
export function formatRelatedSpecs(groups: RelatedSpecGroup[]): string {
  if (!groups.length) return ''
  const out = ['## Related spec']
  let left = RELATED_SPEC_MAX_LINES
  for (const g of groups) {
    out.push(`${g.title} · docs/specs/${g.capability}.md`)
    if (!g.names.length) out.push('- (no requirements yet)')
    const shown = g.names.slice(0, Math.max(0, left))
    out.push(...shown.map(n => `- ${n}`))
    if (g.names.length > shown.length) out.push(`- … ${g.names.length - shown.length} more`)
    left -= shown.length
  }
  out.push('Read with vibedoc_get_spec { capability, requirement? }')
  return out.join('\n')
}

/** One line per spec for vibedoc_list_specs: "- board-views · Board views · 2 requirements · 3 scenarios". */
export function formatSpecList(specs: Spec[]): string {
  if (!specs.length) return 'No capability specs yet. Add one as docs/specs/<capability>.md.'
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
  return specs.map(s => `- ${s.capability} · ${s.title} · ${n(s.requirements.length, 'requirement')} · ${n(s.requirements.reduce((a, r) => a + r.scenarios.length, 0), 'scenario')}`).join('\n')
}

/** A requirement by name (case-insensitive), back as markdown with its scenarios. */
export function findRequirement(spec: Spec, name: string): SpecRequirement | null {
  const want = name.trim().toLowerCase()
  return spec.requirements.find(r => r.name.toLowerCase() === want) ?? null
}
export function formatRequirement(r: SpecRequirement): string {
  return [`### Requirement: ${r.name}`, r.text, ...r.scenarios.map(sc => `\n#### Scenario: ${sc.name}\n${sc.text}`.trimEnd())].filter(Boolean).join('\n')
}

export type SpecContextTask = { id: string; title: string; finished: string | null; goal: string; acceptance: string }
export type SpecContextEpic = { id: string; title: string; doneWhen: string; tasks: SpecContextTask[] }
export type SpecContext = {
  capability: string
  epics: SpecContextEpic[]
  docs: { path: string; lines: string[] }[]
  entries: { id: string; type: string; summary: string }[]
  existing: string | null
}

const SPEC_FORMAT = [
  '# <Capability name>',
  '',
  '## Purpose',
  'What it does for the user today, in two or three sentences.',
  '',
  '## Requirements',
  '',
  '### Requirement: <short name>',
  'The system SHALL <one observable behaviour>.',
  '',
  '#### Scenario: <case>',
  '- WHEN <the user or system does something>',
  '- THEN <what they observe>',
]

/** A section's body (`## Goal`, `## Acceptance criteria`), up to the next `## ` heading; '' when missing. */
export function taskSection(raw: string, heading: string): string {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^## ${esc}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(raw)?.[1].trim() ?? ''
}

const estimate = (s: string) => Math.ceil(s.length / 4)

/**
 * Everything already written about a capability, for an agent drafting its spec (R066), within `budgetTokens`:
 * when over, the oldest done tasks (by Done date, then id) are cut first and the cut is counted.
 */
export function formatSpecContext(ctx: SpecContext, budgetTokens: number): string {
  const { capability } = ctx
  const target = `docs/specs/${capability}.md`
  if (!ctx.epics.length && !ctx.docs.length && !ctx.entries.length && ctx.existing === null) {
    return `Nothing found for "${capability}": no epic, doc or knowledge entry matches. ` +
      'Pass epics: ["R004", …] (vibedoc_get_roadmap lists them) or a query: with the words the project uses for it.'
  }
  const instructions = [
    '## How to draft the spec',
    `Write ${target} in this format (only headings shown are parsed; nothing is mandatory):`,
    '```md', ...SPEC_FORMAT, '```',
    '- Write observable behaviour (what a user or agent sees today), not implementation: no file names, functions or libraries.',
    '- One requirement per behaviour, each with at least one WHEN/THEN scenario. Leave out what was planned but never shipped.',
    ctx.existing === null
      ? `- Propose it with vibedoc_propose_edit at ${target} (edits: [{ old_string: "", new_string: <the spec> }]); the human accepts the diff. Never write it directly.`
      : `- A spec exists already: propose changes to it with vibedoc_propose_edit at ${target}. Never write it directly.`,
  ].join('\n')

  const render = (cut: Set<string>) => {
    const out = [`# Spec context: ${capability}`]
    if (ctx.existing !== null) out.push('', `## Existing spec (${target})`, ctx.existing.trim())
    for (const e of ctx.epics) {
      out.push('', `## ${e.id}: ${e.title}`)
      if (e.doneWhen) out.push(`**Done when:** ${e.doneWhen}`)
      const shown = e.tasks.filter(t => !cut.has(t.id))
      if (!e.tasks.length) out.push('(no done tasks)')
      for (const t of shown) {
        out.push('', `### ${t.id}: ${t.title}${t.finished ? ` (done ${t.finished})` : ''}`)
        if (t.goal) out.push(t.goal)
        if (t.acceptance) out.push('', 'Acceptance:', t.acceptance)
      }
      const gone = e.tasks.length - shown.length
      if (gone) out.push('', `(${gone} older task${gone === 1 ? '' : 's'} cut to fit)`)
    }
    if (ctx.docs.length) out.push('', '## Related docs', ...ctx.docs.flatMap(d => [`- ${d.path}`, ...d.lines.map(l => `  > ${l}`)]))
    if (ctx.entries.length) out.push('', '## Knowledge entries', ...ctx.entries.map(e => `- ${e.id} · ${e.type} · ${e.summary}`))
    out.push('', instructions)
    return out.join('\n')
  }

  const oldestFirst = ctx.epics.flatMap(e => e.tasks)
    .sort((a, b) => (a.finished ?? '').localeCompare(b.finished ?? '') || a.id.localeCompare(b.id, 'en', { numeric: true }))
  const cut = new Set<string>()
  let text = render(cut)
  for (const t of oldestFirst) {
    if (estimate(text) <= budgetTokens) break
    cut.add(t.id)
    text = render(cut)
  }
  // ponytail: re-renders per cut task (O(n²) on a few hundred tasks at most); cut in batches if that ever shows
  return cut.size ? `${text}\n\n${cut.size} older task${cut.size === 1 ? '' : 's'} cut to stay under ~${budgetTokens} tokens; read them with vibedoc_get_task.` : text
}

// ─── Spec changes on epics (R069): OpenSpec's delta, kept in the epic body ───────────────────────────────────────
//
//   ## Spec changes
//   ### memory
//   #### ADDED Requirement: Entry expiry
//   The system SHALL …
//   ##### Scenario: …
//   #### MODIFIED Requirement: Session budget      (the full new text + scenarios)
//   #### REMOVED Requirement: Legacy index          (the reason)
//   #### RENAMED Requirement: Recall → Keyword recall
//
// In the epic a requirement is `####` and its scenarios `#####`; in the spec they are `###` / `####`.

export const DELTA_OPS = ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'] as const
export type DeltaOp = { op: (typeof DELTA_OPS)[number]; name: string; newName?: string; text: string }
export type SpecChange = { capability: string; ops: DeltaOp[] }

const OP_HEADING = /^####\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirement:\s*(.+?)\s*$/i
const HEADING = /^(#{1,6})\s/
const trimBlank = (ls: string[]) => {
  let a = 0, b = ls.length
  while (a < b && !ls[a].trim()) a++
  while (b > a && !ls[b - 1].trim()) b--
  return ls.slice(a, b)
}

/** The `## Spec changes` section of an epic body → per capability, its ops in order. */
export function parseSpecChanges(body: string): SpecChange[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const code = fenced(lines)
  const start = lines.findIndex((l, i) => !code[i] && /^##\s+Spec changes\s*$/i.test(l.trim()))
  if (start < 0) return []
  const out: SpecChange[] = []
  let op: (DeltaOp & { lines: string[] }) | null = null
  const flush = () => {
    if (op && out.length) out[out.length - 1].ops.push({ op: op.op, name: op.name, ...(op.newName ? { newName: op.newName } : {}), text: trimBlank(op.lines).join('\n') })
    op = null
  }
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    const depth = code[i] ? 0 : HEADING.exec(l)?.[1].length ?? 0
    if (depth && depth <= 2) break
    if (depth === 3) {
      flush()
      out.push({ capability: l.replace(/^###\s+/, '').trim().toLowerCase(), ops: [] })
      continue
    }
    const m = depth === 4 ? OP_HEADING.exec(l.trim()) : null
    if (m) {
      flush()
      const kind = m[1].toUpperCase() as DeltaOp['op']
      const [name, newName] = kind === 'RENAMED' ? m[2].split(/\s*(?:→|->)\s*/) : [m[2]]
      op = { op: kind, name: name.trim(), ...(newName?.trim() ? { newName: newName.trim() } : {}), text: '', lines: [] }
      continue
    }
    op?.lines.push(l)
  }
  flush()
  return out.filter(c => c.capability)
}

/** Requirement blocks of a spec: `### Requirement:` up to the next heading of depth ≤ 3 or EOF (scenarios move with it). */
function requirementBlocks(lines: string[]): { name: string; start: number; end: number }[] {
  const code = fenced(lines)
  const blocks: { name: string; start: number; end: number }[] = []
  lines.forEach((l, i) => {
    if (code[i]) return
    const depth = HEADING.exec(l)?.[1].length ?? 0
    if (!depth || depth > 3) return
    const last = blocks.at(-1)
    if (last && last.end < 0) last.end = i
    const m = depth === 3 ? /^###\s+Requirement:\s*(.+?)\s*$/i.exec(l) : null
    if (m) blocks.push({ name: m[1], start: i, end: -1 })
  })
  const last = blocks.at(-1)
  if (last && last.end < 0) last.end = lines.length
  return blocks
}

/** An epic requirement (`#####` scenarios) as spec lines: heading + text with every heading one level up. */
function specBlock(name: string, text: string): string[] {
  const body = text.split('\n')
  const code = fenced(body)
  return [`### Requirement: ${name}`, ...trimBlank(body.map((l, i) => (!code[i] && /^#{2,6}\s/.test(l) ? l.slice(1) : l)))]
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The spec after `ops`, in order; text outside the touched requirement blocks is kept byte-for-byte. Errors (an
 * ADDED name that exists, a MODIFIED / REMOVED / RENAMED name that doesn't) skip that op. `null` spec = none yet:
 * ADDED ops start one with an H1 from `capability`.
 */
export function applyDelta(specRaw: string | null, ops: DeltaOp[], capability = 'capability'): { raw: string; errors: string[] } {
  const errors: string[] = []
  const title = capability.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase())
  let lines = (specRaw ?? `# ${title}\n\n## Requirements\n`).split('\n')
  for (const o of ops) {
    const blocks = requirementBlocks(lines)
    const hit = blocks.find(b => same(b.name, o.name))
    if (o.op === 'ADDED') {
      if (hit) { errors.push(`ADDED "${o.name}": the spec already has this requirement`); continue }
      const block = specBlock(o.name, o.text)
      const last = blocks.at(-1)
      if (last && last.end < lines.length) {
        const pad = lines[last.end - 1]?.trim() ? [''] : []
        lines.splice(last.end, 0, ...pad, ...block, '')
      } else {
        // at the end of the file: one blank line before, a trailing newline after
        lines = [...trimBlankEnd(lines), '', ...block, '']
      }
      continue
    }
    if (!hit) { errors.push(`${o.op} "${o.name}": no such requirement in the spec`); continue }
    if (o.op === 'RENAMED') {
      if (!o.newName) { errors.push(`RENAMED "${o.name}": give the new name as "Old → New"`); continue }
      if (blocks.some(b => b !== hit && same(b.name, o.newName ?? ''))) { errors.push(`RENAMED "${o.name}": "${o.newName}" already exists`); continue }
      lines[hit.start] = lines[hit.start].replace(/(Requirement:\s*).+$/i, `$1${o.newName}`)
      continue
    }
    if (o.op === 'REMOVED') { lines.splice(hit.start, hit.end - hit.start); continue }
    // MODIFIED: replace the block, keeping the blank lines that separated it from what follows
    let keep = 0
    while (hit.end - keep - 1 > hit.start && !lines[hit.end - keep - 1].trim()) keep++
    lines.splice(hit.start, hit.end - keep - hit.start, ...specBlock(o.name, o.text))
  }
  if (specRaw === null && errors.length === ops.length) return { raw: '', errors }
  return { raw: lines.join('\n'), errors }
}

function trimBlankEnd(ls: string[]): string[] {
  let b = ls.length
  while (b > 0 && !ls[b - 1].trim()) b--
  return ls.slice(0, b)
}
