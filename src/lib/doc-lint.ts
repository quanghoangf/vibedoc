// Pure doc lint (R088, no fs). Self-check: node src/lib/doc-lint.check.mts
// One pass over every .md file + the doc graph (R056) → issues with level, rule and 1-based line. Core's
// `getDocLint(root, path?)` feeds it the cached files; `vibedoc_check_docs`, `GET /api/docs/lint` and the /docs panel
// read the result. Reused by later epics (a CI check, the doc upkeep agent), so keep it pure and the shapes stable.

import type { DocGraph } from './doc-links'
import type { Spec } from './specs'

export type LintLevel = 'error' | 'warn'
export type LintRule = 'broken-link' | 'stale-path' | 'bad-frontmatter' | 'no-h1' | 'empty-doc' | 'orphan-doc' | 'spec-structure' | 'spec-changes' | 'outdated-ref'
export type LintIssue = {
  path: string
  /** 1-based line in the raw file */
  line: number
  level: LintLevel
  rule: LintRule
  message: string
  /** link rules: the raw link target, so a viewer can reveal it (`/docs?doc=&link=`) */
  target?: string
  /** text of the nearest heading at or above `line` (outside code fences), so a viewer can scroll to that section */
  heading?: string
  /** outdated-ref (R092): the done task whose commits renamed / deleted `target`, and the new path when renamed */
  task?: string
  renamedTo?: string
}
export type LintFile = { path: string; raw: string }
/** Everything a caller shows: totals over the checked files, issues sorted by path then line. */
export type DocLint = { files: number; errors: number; warnings: number; issues: LintIssue[] }

export const LINT_LEVEL: Record<LintRule, LintLevel> = {
  'broken-link': 'error',
  'stale-path': 'warn',
  'bad-frontmatter': 'error',
  'no-h1': 'warn',
  'empty-doc': 'warn',
  'orphan-doc': 'warn',
  'spec-structure': 'warn',
  'spec-changes': 'error',
  'outdated-ref': 'warn',
}

/** A capability spec as `parseSpec` read it (core parses; pure libs don't import each other's values). */
export type LintSpec = { path: string; spec: Spec }
/**
 * One op of an unmerged epic's `## Spec changes` that wouldn't apply (`applyDelta` run op by op), or a capability
 * that isn't a slug (`op` / `name` empty then).
 */
export type LintSpecChange = { path: string; capability: string; op: string; name: string; message: string }
/** R092: a doc naming a path a done task renamed (`to`) or deleted, as `outdatedRefs` (doc-upkeep.ts) finds it. */
export type LintOutdated = { path: string; line: number; taskId: string; from: string; to?: string }
export type LintOptions = { path?: string; specs?: readonly LintSpec[]; specChanges?: readonly LintSpecChange[]; outdated?: readonly LintOutdated[] }

const FM_LINE = /^(?:\s*$|\s*#|[A-Za-z_][\w-]*\s*:|["'][^"']+["']\s*:|\s*-\s|\s+\S)/

/** The leading `---` block: its closing line index (0-based), or -1 when the file has none. Unclosed → `null`. */
function frontmatterEnd(lines: string[]): number | null {
  if (lines[0]?.trim() !== '---') return -1
  const end = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l))
  return end > 0 ? end : null
}

function fileIssues({ path, raw }: LintFile): LintIssue[] {
  const out: LintIssue[] = []
  const add = (rule: LintRule, line: number, message: string) => out.push({ path, line, level: LINT_LEVEL[rule], rule, message })
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const end = frontmatterEnd(lines)
  if (end === null) {
    add('bad-frontmatter', 1, 'Frontmatter starts with --- but is never closed')
    return out
  }
  let titled = false
  if (end > 0) {
    for (let i = 1; i < end; i++) {
      if (!FM_LINE.test(lines[i])) add('bad-frontmatter', i + 1, `Frontmatter line is not "key: value": ${lines[i].trim().slice(0, 60)}`)
      if (/^title\s*:\s*\S/.test(lines[i])) titled = true
    }
  }
  const body = lines.slice(end + 1)
  if (!body.join('').trim()) {
    add('empty-doc', 1, 'The doc has no content')
    return out
  }
  let inFence = false
  const hasH1 = body.some((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return false }
    return !inFence && /^#\s+\S/.test(l)
  })
  // a frontmatter `title:` is the page title in site generators (Starlight), so no H1 is expected there
  if (!hasH1 && !titled) add('no-h1', end + 2, 'No "# Title" heading')
  return out
}

/**
 * Lint `files` (every .md, as core reads them) against `graph` (`buildDocGraph` over the same files). `opts.path`
 * keeps one file's issues; the graph still resolves links against the whole project. Sorted by path, then line.
 */
export function lintDocs(files: readonly LintFile[], graph: DocGraph, opts: LintOptions = {}): LintIssue[] {
  const only = opts.path?.replace(/\\/g, '/').replace(/^\.?\//, '')
  const keep = (p: string) => !only || p === only
  const issues: LintIssue[] = []
  for (const f of files) if (keep(f.path)) issues.push(...fileIssues(f))
  for (const b of graph.broken) {
    if (keep(b.from)) issues.push({ path: b.from, line: b.line, level: LINT_LEVEL['broken-link'], rule: 'broken-link', message: `Link to "${b.target}" points to no file`, target: b.target })
  }
  for (const s of graph.stale) {
    if (keep(s.from)) issues.push({ path: s.from, line: s.line, level: LINT_LEVEL['stale-path'], rule: 'stale-path', message: `\`${s.target}\` names a file that doesn't exist`, target: s.target })
  }
  const raws = new Map(files.map(f => [f.path, f.raw]))
  const linked = new Set(graph.edges.map(e => e.to))
  for (const n of graph.nodes) {
    if (keep(n.path) && ORPHAN_KINDS.has(n.kind) && n.path.startsWith('docs/') && !linked.has(n.path)) {
      issues.push({ path: n.path, line: 1, level: LINT_LEVEL['orphan-doc'], rule: 'orphan-doc', message: 'No other file links to this doc' })
    }
  }
  for (const s of opts.specs ?? []) if (keep(s.path)) issues.push(...specIssues(s, raws.get(s.path) ?? ''))
  for (const c of opts.specChanges ?? []) {
    if (!keep(c.path)) continue
    const lines = (raws.get(c.path) ?? '').split('\n')
    const line = headingLine(lines, OP_RE(c.op, c.name)) || headingLine(lines, new RegExp(`^###\\s+${esc(c.capability)}\\s*$`, 'i'))
      || headingLine(lines, /^##\s+Spec changes\s*$/i) || 1
    issues.push({ path: c.path, line, level: LINT_LEVEL['spec-changes'], rule: 'spec-changes', message: `Spec changes for "${c.capability}": ${c.message}` })
  }
  for (const o of opts.outdated ?? []) {
    if (!keep(o.path)) continue
    const message = o.to ? `\`${o.from}\` was renamed to \`${o.to}\` by ${o.taskId}` : `\`${o.from}\` was deleted by ${o.taskId}`
    issues.push({ path: o.path, line: o.line, level: LINT_LEVEL['outdated-ref'], rule: 'outdated-ref', message, target: o.from, task: o.taskId, ...(o.to && { renamedTo: o.to }) })
  }
  for (const i of issues) {
    const h = headingAbove(raws.get(i.path) ?? '', i.line)
    if (h) i.heading = h
  }
  return issues.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule))
}

/** Text of the last `#` heading on or before 1-based `line`, outside code fences; '' when none. */
function headingAbove(raw: string, line: number): string {
  let inFence = false
  let found = ''
  const lines = raw.split('\n')
  for (let i = 0; i < Math.min(line, lines.length); i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue }
    const m = inFence ? null : /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[i])
    if (m) found = m[1]
  }
  return found
}

const ORPHAN_KINDS = new Set(['doc', 'adr', 'spec'])
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const OP_RE = (op: string, name: string) => (op && name ? new RegExp(`^####\\s+${esc(op)}\\s+Requirement:\\s*${esc(name)}`, 'i') : null)

/** 1-based line of the `nth` (0-based) heading matching `re` outside code fences, 0 when none. */
function headingLine(lines: string[], re: RegExp | null, nth = 0): number {
  if (!re) return 0
  let inFence = false
  let seen = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue }
    if (!inFence && re.test(lines[i].trim()) && seen++ === nth) return i + 1
  }
  return 0
}

/** A spec with no requirements, a requirement name used twice, a scenario without a WHEN or THEN bullet. */
function specIssues({ path, spec }: LintSpec, raw: string): LintIssue[] {
  const lines = raw.split('\n')
  const out: LintIssue[] = []
  const add = (line: number, message: string) => out.push({ path, line: line || 1, level: LINT_LEVEL['spec-structure'], rule: 'spec-structure', message })
  if (!spec.requirements.length) add(headingLine(lines, /^#\s/), 'Capability spec has no "### Requirement:" heading')
  const seen = new Map<string, number>()
  for (const r of spec.requirements) {
    const key = r.name.trim().toLowerCase()
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    const reqRe = new RegExp(`^###\\s+Requirement:\\s*${esc(r.name)}\\s*$`, 'i')
    if (n) add(headingLine(lines, reqRe, n), `Requirement "${r.name}" appears more than once`)
    const scenarioSeen = new Map<string, number>()
    for (const sc of r.scenarios) {
      const k = sc.name.trim().toLowerCase()
      const m = scenarioSeen.get(k) ?? 0
      scenarioSeen.set(k, m + 1)
      const missing = [!/\bWHEN\b/.test(sc.text) && 'WHEN', !/\bTHEN\b/.test(sc.text) && 'THEN'].filter(Boolean)
      if (!missing.length) continue
      // the scenario heading inside this requirement: search from the requirement's own heading
      const from = headingLine(lines, reqRe, n)
      const rel = headingLine(lines.slice(from), new RegExp(`^####\\s+Scenario:\\s*${esc(sc.name)}\\s*$`, 'i'), m)
      add(rel ? from + rel : from, `Scenario "${sc.name}" has no ${missing.join(' or ')} bullet`)
    }
  }
  return out
}

/** Totals for a lint run over `files` checked files. */
export function summarizeLint(issues: LintIssue[], files: number): DocLint {
  const errors = issues.filter(i => i.level === 'error').length
  return { files, errors, warnings: issues.length - errors, issues }
}

/**
 * Agent-facing text: a one-line verdict, then issues grouped by file (`  L12 error broken-link: …`), errors' files
 * first. At most `cap` issue lines; the rest is counted so the agent can narrow with a path.
 */
export function formatLint(lint: DocLint, cap = 150): string {
  if (!lint.issues.length) return `✅ Docs check: no issues in ${lint.files} file${lint.files === 1 ? '' : 's'}`
  const byFile = new Map<string, LintIssue[]>()
  for (const i of lint.issues) byFile.set(i.path, [...(byFile.get(i.path) ?? []), i])
  const files = [...byFile.entries()].sort(([a, x], [b, y]) =>
    Number(y.some(i => i.level === 'error')) - Number(x.some(i => i.level === 'error')) || a.localeCompare(b))
  const out = [`🩺 Docs check: ${lint.errors} error${lint.errors === 1 ? '' : 's'} · ${lint.warnings} warning${lint.warnings === 1 ? '' : 's'} in ${byFile.size} of ${lint.files} files`]
  let shown = 0
  for (const [path, list] of files) {
    if (shown >= cap) break
    out.push('', `**${path}**`)
    for (const i of list) {
      if (shown >= cap) break
      out.push(`  L${i.line} ${i.level} ${i.rule}: ${i.message}`)
      shown++
    }
  }
  if (shown < lint.issues.length) out.push('', `… ${lint.issues.length - shown} more. Pass \`path\` to check one file.`)
  return out.join('\n')
}
