// Pure Claude Code memory parsing (R052, no fs). Self-check: node src/lib/claude-memory.check.mts
// Claude Code keeps one fact per <config>/projects/<slug>/memory/<name>.md, with a frontmatter of name/description/type.
import type { Entry, EntryType } from './entries'

export type ClaudeMemoryCandidate = { name: string; type: EntryType; summary: string; body: string; file: string }

// Same as SUMMARY_MAX in entries.ts; a value import would break `node *.check.mts` (pure libs import types only)
const SUMMARY_MAX = 120

/** "/Users/x/work/vibedoc" → "-Users-x-work-vibedoc": every non-alphanumeric character becomes "-". */
export function claudeProjectSlug(absRoot: string): string {
  return absRoot.replace(/[^a-zA-Z0-9]/g, '-')
}

/** feedback / user → preference, project → decision, reference and anything else → convention. */
export function mapClaudeType(t: string | undefined): EntryType {
  switch ((t ?? '').trim().toLowerCase()) {
    case 'feedback':
    case 'user': return 'preference'
    case 'project': return 'decision'
    default: return 'convention'
  }
}

const KEYS = ['name', 'description', 'type']
const unquote = (v: string) => v.trim().replace(/^(['"])(.*)\1$/, '$2')

/**
 * One memory file → an entry candidate; null without frontmatter, `name` or `description`.
 * Line-based reader for `name`, `description` and `type` (top level or under `metadata:`), not a YAML parser.
 */
export function parseClaudeMemory(raw: string, file: string): ClaudeMemoryCandidate | null {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end < 0) return null
  const fm: Record<string, string> = {}
  let last = ''
  for (const line of lines.slice(1, end)) {
    const m = /^\s*([\w-]+):(?:\s+(.*))?$/.exec(line)
    if (m) {
      last = m[1]
      if (KEYS.includes(last) && !(last in fm)) fm[last] = unquote((m[2] ?? '').replace(/^[|>][-+]?$/, ''))
    } else if (last === 'description' && line.trim()) {
      fm.description = `${fm.description} ${line.trim()}` // wrapped or `|` / `>` block value
    }
  }
  const name = fm.name ?? ''
  const summary = (fm.description ?? '').replace(/\s+/g, ' ').trim().slice(0, SUMMARY_MAX).trim()
  if (!name || !summary) return null
  return { name, type: mapClaudeType(fm.type), summary, body: lines.slice(end + 1).join('\n').trim(), file }
}

export const CLAUDE_SOURCE_PREFIX = 'claude-code:'

export type ImportPlan = {
  create: ClaudeMemoryCandidate[]
  update: { entry: Entry; candidate: ClaudeMemoryCandidate }[]
  unchanged: { entry: Entry; candidate: ClaudeMemoryCandidate }[]
  /** Entries imported earlier whose Claude Code memory is gone; listed, never deleted. */
  onlyInVibedoc: Entry[]
}

/**
 * Dedupe by `**Source:** claude-code:<name>` only: a match is an update when type, summary or body differ, else unchanged;
 * everything else is new. Entries without a source never match. A repeated candidate name counts once (first wins).
 */
export function planImport(candidates: ClaudeMemoryCandidate[], entries: Entry[]): ImportPlan {
  const bySource = new Map<string, Entry>()
  for (const e of entries) if (e.source && !bySource.has(e.source)) bySource.set(e.source, e)
  const plan: ImportPlan = { create: [], update: [], unchanged: [], onlyInVibedoc: [] }
  const seen = new Set<string>()
  for (const c of candidates) {
    const source = CLAUDE_SOURCE_PREFIX + c.name
    if (seen.has(source)) continue
    seen.add(source)
    const entry = bySource.get(source)
    if (!entry) plan.create.push(c)
    else if (entry.type !== c.type || entry.summary !== c.summary || entry.body !== c.body) plan.update.push({ entry, candidate: c })
    else plan.unchanged.push({ entry, candidate: c })
  }
  plan.onlyInVibedoc = [...bySource.values()].filter(e => e.source?.startsWith(CLAUDE_SOURCE_PREFIX) && !seen.has(e.source))
  return plan
}
