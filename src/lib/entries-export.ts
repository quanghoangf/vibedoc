// Pure export of knowledge entries into a managed block of AGENTS.md / CLAUDE.md (R052, no fs).
// Self-check: node src/lib/entries-export.check.mts
import type { Entry, EntryType } from './entries'

export const BLOCK_START = '<!-- vibedoc:entries:start -->'
export const BLOCK_END = '<!-- vibedoc:entries:end -->'
const LINE_BODY_MAX = 200
// Markers count only as whole lines, so a marker quoted in prose, a code span or an entry line (always `- …`) is plain text
const lineRe = (marker: string) => new RegExp(`^${marker}\\r?$`, 'gm')

// Same order as ENTRY_TYPES in entries.ts (a value import would break `node *.check.mts`; the check asserts they match)
export const TYPE_HEADINGS: Record<EntryType, string> = {
  convention: 'Conventions',
  gotcha: 'Gotchas',
  decision: 'Decisions',
  preference: 'Preferences',
}

/** `summary: first body line (≤200 chars) (E001)`. */
function entryLine(e: Entry): string {
  const first = e.body.split(/\r?\n/).map(l => l.trim()).find(Boolean)
  return `- ${e.summary}${first ? `: ${first.slice(0, LINE_BODY_MAX).trim()}` : ''} (${e.id})`
}

/** The block, markers included, with `\n` line endings and no date, so an unchanged set renders byte-identical. */
export function renderEntriesBlock(entries: Entry[]): string {
  const out = [BLOCK_START, '## Project memory', '_Generated from memory/entries/ by VibeDoc. Edit the entries, not this block._']
  const byId = (a: Entry, b: Entry) => a.id.localeCompare(b.id, 'en', { numeric: true })
  for (const [type, heading] of Object.entries(TYPE_HEADINGS)) {
    const group = entries.filter(e => e.type === type).sort(byId)
    if (group.length) out.push('', `### ${heading}`, ...group.map(entryLine))
  }
  if (!entries.length) out.push('', '_No entries yet._')
  out.push(BLOCK_END)
  return out.join('\n')
}

/**
 * Replace the text between the markers (inclusive) with `block`, or append it after one blank line when neither marker
 * is there. Everything outside the markers stays byte-for-byte; the block takes the file's line endings.
 * One marker alone (or end before start) → error, so a hand-broken block is never guessed at.
 * Markers match only as whole lines; the first end line after the first start line closes the block.
 */
export function upsertManagedBlock(fileText: string, block: string): { text: string } | { error: string } {
  const eol = fileText.includes('\r\n') ? '\r\n' : '\n'
  const b = block.replace(/\r?\n/g, eol)
  const find = (marker: string, from = 0) => {
    const re = lineRe(marker)
    re.lastIndex = from
    return re.exec(fileText)?.index ?? -1
  }
  const start = find(BLOCK_START)
  const endAfter = start >= 0 ? find(BLOCK_END, start) : -1
  if (endAfter >= 0) return { text: fileText.slice(0, start) + b + fileText.slice(endAfter + BLOCK_END.length) }
  const end = find(BLOCK_END)
  if (start >= 0 || end >= 0) return { error: `found ${start >= 0 && end >= 0 ? `${BLOCK_END} before ${BLOCK_START}` : `only ${start >= 0 ? BLOCK_START : BLOCK_END}`}; fix or remove the markers by hand` }
  if (!fileText) return { text: b + eol }
  let base = fileText
  if (!base.endsWith(eol)) base += eol
  if (!base.endsWith(eol + eol)) base += eol
  return { text: base + b + eol }
}
