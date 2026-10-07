// Pure doc lint (R088, no fs). Self-check: node src/lib/doc-lint.check.mts
// One pass over every .md file + the doc graph (R056) → issues with level, rule and 1-based line. Core's
// `getDocLint(root, path?)` feeds it the cached files; `vibedoc_check_docs`, `GET /api/docs/lint` and the /docs panel
// read the result. Reused by later epics (a CI check, the doc upkeep agent), so keep it pure and the shapes stable.

import type { DocGraph } from './doc-links'

export type LintLevel = 'error' | 'warn'
export type LintRule = 'broken-link' | 'stale-path' | 'bad-frontmatter' | 'no-h1' | 'empty-doc'
export type LintIssue = {
  path: string
  /** 1-based line in the raw file */
  line: number
  level: LintLevel
  rule: LintRule
  message: string
  /** link rules: the raw link target, so a viewer can reveal it (`/docs?doc=&link=`) */
  target?: string
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
}

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
export function lintDocs(files: readonly LintFile[], graph: DocGraph, opts: { path?: string } = {}): LintIssue[] {
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
  return issues.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule))
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
