// Pure knowledge-entry parsing and formatting (R046, no fs). Self-check: node src/lib/entries.check.mts
// One long-lived fact per file: memory/entries/E001-<slug>.md

export const ENTRY_TYPES = ['convention', 'gotcha', 'decision', 'preference'] as const
export type EntryType = typeof ENTRY_TYPES[number]

/**
 * updatedAt = the `**Updated:**` date (YYYY-MM-DD); by = `**By:**` who saved it last ("human" | "ai:<agent>",
 * null in files from before R047); file = path relative to root.
 */
export type Entry = { id: string; type: EntryType; summary: string; body: string; updatedAt: string; by: string | null; file: string }
export type EntryInput = { id?: string; type: string; summary: string; body?: string }

export const SUMMARY_MAX = 120

const isEntryType = (s: string): s is EntryType => (ENTRY_TYPES as readonly string[]).includes(s)

/** "e1" / "E01" / "E001" → "E001"; anything else → null. */
export function normalizeEntryId(s: string): string | null {
  const m = /^e(\d+)$/i.exec(s.trim())
  if (!m) return null
  const n = Number(m[1])
  return n > 0 ? `E${String(n).padStart(3, '0')}` : null
}

/** One past the highest id: [] → "E001"; ["E001","E007"] → "E008". */
export function nextEntryId(ids: string[]): string {
  const max = Math.max(0, ...ids.map(id => Number(normalizeEntryId(id)?.slice(1) ?? 0)))
  return `E${String(max + 1).padStart(3, '0')}`
}

export function entrySlug(summary: string): string {
  return summary.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '')
}

/** null when the `# E001: summary` H1 or a known `**Type:**` is missing. */
export function parseEntry(raw: string, file: string): Entry | null {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const h1 = /^#\s+(E\d+):\s*(.+?)\s*$/i.exec(lines[0] ?? '')
  const id = h1 && normalizeEntryId(h1[1])
  if (!h1 || !id) return null
  // Contiguous **Key:** Value block under the H1, like task files
  const meta: Record<string, string> = {}
  let i = 1
  for (; i < lines.length; i++) {
    const m = /^\*\*(\w+):\*\*\s*(.*)$/.exec(lines[i])
    if (!m) break
    meta[m[1].toLowerCase()] = m[2].trim()
  }
  const type = meta.type ?? ''
  if (!isEntryType(type)) return null
  return { id, type, summary: h1[2], body: lines.slice(i).join('\n').trim(), updatedAt: meta.updated ?? '', by: meta.by || null, file }
}

export function formatEntry(e: Omit<Entry, 'file'>): string {
  const head = `# ${e.id}: ${e.summary}\n**Type:** ${e.type}\n**Updated:** ${e.updatedAt}\n${e.by ? `**By:** ${e.by}\n` : ''}`
  return e.body.trim() ? `${head}\n${e.body.trim()}\n` : head
}

/** Error message, or null when valid. Does not check whether an id exists. */
export function validateEntryInput(i: EntryInput): string | null {
  if (i.id !== undefined && !normalizeEntryId(String(i.id))) return `Invalid id "${i.id}": expected E followed by a number, e.g. E001`
  if (!isEntryType(String(i.type ?? ''))) return `Invalid type "${i.type ?? ''}": use one of ${ENTRY_TYPES.join(', ')}`
  const summary = String(i.summary ?? '').trim()
  if (!summary) return 'summary is required'
  if (/\n/.test(summary)) return 'summary must be one line'
  if (summary.length > SUMMARY_MAX) return `summary is ${summary.length} characters; keep it to ${SUMMARY_MAX}`
  if (i.body !== undefined && typeof i.body !== 'string') return 'body must be a string'
  return null
}

/**
 * Replace whole-token mentions of `fromIds` (any padding: E11, E011) with `toId`, for a merge (R051).
 * Same token boundaries as the memory graph's ID_RE, so "XE011" and "E011a" stay.
 */
export function replaceEntryRefs(text: string, fromIds: string[], toId: string): string {
  const from = new Set(fromIds.map(id => normalizeEntryId(id)))
  return text.replace(/(?<![A-Za-z0-9_-])E\d+(?![A-Za-z0-9_])/g, m => (from.has(normalizeEntryId(m)) ? toId : m))
}
