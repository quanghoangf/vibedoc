// Doc properties live in YAML frontmatter (`priority: P1`, `status: draft`) so agents reading the file see
// them and they survive rename/move. Only flat `key: value` lines are properties; anything else in the
// block (lists, nested maps) is kept byte-for-byte. Pure: no fs, no React.

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
export type Priority = (typeof PRIORITIES)[number]

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/
const PROPERTY_LINE = /^([A-Za-z][\w-]*):[ \t]*(.*?)[ \t]*$/
export const PROPERTY_KEY = /^[A-Za-z][\w-]{0,39}$/

/** "P1" / "p1" / "high"-free: a priority value, or null. Also used for `**Priority:**` meta lines. */
export function parsePriority(raw: string | null | undefined): Priority | null {
  const s = (raw ?? '').trim().replace(/^["']|["']$/g, '').toUpperCase()
  return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : null
}

/** The leading `---` block, if any: its inner lines and total length. */
function frontmatter(content: string): { inner: string; length: number } | null {
  const m = FRONTMATTER.exec(content)
  return m ? { inner: m[1], length: m[0].length } : null
}

/** Content without its frontmatter block, for rendering and stats. */
export function stripFrontmatter(content: string): string {
  const fm = frontmatter(content)
  return fm ? content.slice(fm.length).replace(/^\r?\n/, '') : content
}

function unquote(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")
  return v
}

/** YAML-safe scalar: plain when it can't be misread, double-quoted otherwise. */
function quote(v: string): string {
  return /^[\w][\w .,/()+-]*$/.test(v) && !/^(true|false|null|yes|no|~)$/i.test(v) ? v : `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Flat `key: value` frontmatter entries, in file order. A key with no value (a list or map follows) is left out. */
export function docProperties(content: string): { key: string; value: string }[] {
  const fm = frontmatter(content)
  if (!fm) return []
  return fm.inner.split(/\r?\n/).flatMap((l) => {
    const m = PROPERTY_LINE.exec(l)
    return m && m[2] !== '' ? [{ key: m[1], value: unquote(m[2]) }] : []
  })
}

export function docPriority(content: string): Priority | null {
  return parsePriority(docProperties(content).find((p) => p.key.toLowerCase() === 'priority')?.value)
}

/** Set (or remove with null) one property. Other lines and the body stay as they are; an existing key keeps its place, a new one goes last. */
export function setDocProperty(content: string, key: string, value: string | null): string {
  const fm = frontmatter(content)
  const nl = content.includes('\r\n') ? '\r\n' : '\n'
  const line = value === null ? null : `${key}: ${quote(value.replace(/\s+/g, ' ').trim())}`
  if (!fm) return line ? `---${nl}${line}${nl}---${nl}${nl}${content}` : content
  const lines = fm.inner.split(/\r?\n/).filter((l) => l !== '')
  const at = lines.findIndex((l) => PROPERTY_LINE.exec(l)?.[1].toLowerCase() === key.toLowerCase())
  // `tags:` followed by list items: replacing the line would orphan them
  if (at >= 0 && PROPERTY_LINE.exec(lines[at])?.[2] === '') throw new Error(`"${key}" holds a list or map; edit it in the file`)
  if (at >= 0) {
    if (line) lines[at] = line
    else lines.splice(at, 1)
  } else if (line) lines.push(line)
  const body = content.slice(fm.length)
  // Dropping the last key drops the block and the blank line this module put after it
  if (lines.length === 0) return body.replace(/^\r?\n/, '')
  return `---${nl}${lines.join(nl)}${nl}---${nl}${body}`
}

export function setDocPriority(content: string, priority: Priority | null): string {
  return setDocProperty(content, 'priority', priority)
}

/** Sort key: P0 first, unset last. */
export function priorityRank(p: Priority | null | undefined): number {
  return p ? PRIORITIES.indexOf(p) : PRIORITIES.length
}
