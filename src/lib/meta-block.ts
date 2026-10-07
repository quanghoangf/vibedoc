// The `**Key:** Value` block under a task's / epic's H1 (`**Status:** …`, `**Phase:** …`): contiguous lines
// directly under the H1, blank lines between the H1 and the block tolerated. One definition shared by core's
// task/roadmap parsers and the /docs viewer (T505). Frontmatter and `# ` lines inside ``` fences are skipped
// when looking for the H1. Pure: no fs, no React.

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n?---[ \t]*(?:\r?\n|$)/
export const META_LINE = /^\*\*([^*]+):\*\*/
const ENTRY = /^\*\*([^*]+):\*\*[ \t]*(.*?)[ \t]*$/

export interface MetaBlock {
  entries: { key: string; value: string }[]
  /** Line index of the block's first line (no block: the line after the H1) */
  start: number
  /** Line index after the block's last line; equals `start` when there is no block */
  end: number
}

export function parseMetaBlock(raw: string): MetaBlock {
  const lines = raw.split('\n')
  const fm = FRONTMATTER.exec(raw)
  const from = fm ? fm[0].split('\n').length - 1 : 0
  let h1 = -1
  let fence = false
  for (let k = from; k < lines.length; k++) {
    if (/^\s*(```|~~~)/.test(lines[k])) fence = !fence
    else if (!fence && lines[k].startsWith('# ')) { h1 = k; break }
  }
  let i = h1 < 0 ? from : h1 + 1
  let j = i
  while (j < lines.length && lines[j].trim() === '') j++
  if (j < lines.length && META_LINE.test(lines[j])) i = j
  const start = i
  const entries: MetaBlock['entries'] = []
  while (i < lines.length && META_LINE.test(lines[i])) {
    const m = ENTRY.exec(lines[i].replace(/\r$/, ''))
    if (m) entries.push({ key: m[1].trim(), value: m[2] })
    i++
  }
  return { entries, start, end: i }
}

/** The text without its meta block (frontmatter, H1 and body kept), for rendering. */
export function stripMetaBlock(raw: string): string {
  const { start, end } = parseMetaBlock(raw)
  if (start === end) return raw
  const lines = raw.split('\n')
  // the blank line after the block goes too, so the H1 isn't followed by two
  const after = end < lines.length && lines[end].trim() === '' && start > 0 && lines[start - 1].trim() === '' ? end + 1 : end
  return [...lines.slice(0, start), ...lines.slice(after)].join('\n')
}
