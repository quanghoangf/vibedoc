// Pure MEMORY.md section merge (R045, no fs): vibedoc_update_memory rewrites only the sections it is given.
// Self-check: node src/lib/memory-sections.check.mts

export type MemoryIssue = string | { issue: string; severity?: string; status?: string }
export interface MemoryParams {
  currentState?: string
  justCompleted?: string[]
  workingOn?: string
  upNext?: string[]
  issues?: MemoryIssue[]
  decisions?: string[]
  techDebt?: string[]
  handoff?: string
}

const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [v]
const bullets = (v: unknown, empty: string) => list(v).map(i => `- ${i}`).join('\n') || empty

/** Template order. Headings are matched by other code (memory-health.ts) — don't rename them. */
export const SECTIONS: [keyof MemoryParams, string, (v: unknown) => string][] = [
  ['currentState', 'Current state', v => String(v ?? '')],
  ['justCompleted', 'Just completed', v => bullets(v, '- (nothing this session)')],
  ['workingOn', 'Working on now', v => String(v ?? '') || '(nothing active)'],
  ['upNext', 'Up next', v => list(v).map((item, i) => `${i + 1}. ${item}`).join('\n') || '1. (define next steps)'],
  ['issues', 'Active issues', v => '| Issue | Severity | Status |\n|-------|----------|--------|\n' + (list(v).map(i => {
    if (i && typeof i === 'object') {
      const o = i as { issue?: string; severity?: string; status?: string }
      return `| ${o.issue} | ${o.severity || 'medium'} | ${o.status || 'open'} |`
    }
    return `| ${i} | medium | open |`
  }).join('\n') || '| None | — | — |')],
  ['decisions', 'Recent decisions', v => bullets(v, '- (none this session)')],
  ['techDebt', 'Tech debt', v => bullets(v, '- (none noted)')],
  ['handoff', 'Handoff for next session', v => String(v ?? '')],
]
export const MEMORY_KEYS = SECTIONS.map(([k]) => k)
const EMPTY: Record<string, unknown> = { justCompleted: [], upNext: [], issues: [], decisions: [], techDebt: [] }

/** `line` is the heading line without its newline; `body` is everything after it up to the next heading. */
export type MemorySection = { heading: string; line: string; body: string }
export type ParsedMemory = { preamble: string; sections: MemorySection[] }

/** Per line: inside a fenced block (fence lines included)? Closes only on the same char (` or ~), at least as long. */
function fenceFlags(lines: string[]): boolean[] {
  let fence = ''
  return lines.map(line => {
    const m = /^\s*(`{3,}|~{3,})(.*?)\r?\n?$/.exec(line)
    if (!fence) {
      if (m) fence = m[1]
      return !!m
    }
    if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !m[2].trim()) fence = ''
    return true
  })
}

/** Lossless: `joinMemory(parseMemory(md)) === md`. `## ` lines inside fences are not headings. */
export function parseMemory(md: string): ParsedMemory {
  const out: ParsedMemory = { preamble: '', sections: [] }
  const lines = md.split(/(?<=\n)/)
  const fenced = fenceFlags(lines)
  lines.forEach((line, i) => {
    const text = line.replace(/\r?\n$/, '')
    const h = !fenced[i] && /^##\s+(.+?)(?:\s+#+)?\s*$/.exec(text)
    if (h) out.sections.push({ heading: h[1], line: text, body: line.slice(text.length) })
    else if (out.sections.length) out.sections[out.sections.length - 1].body += line
    else out.preamble += line
  })
  return out
}

/** A passed value must not open a section of its own: `## ` lines outside fences become `### `. */
function demoteHeadings(text: string): string {
  const lines = text.split(/(?<=\n)/)
  const fenced = fenceFlags(lines)
  return lines.map((l, i) => fenced[i] ? l : l.replace(/^##(?=\s)/, '###')).join('')
}

export const joinMemory = (p: ParsedMemory) => p.preamble + p.sections.map(s => s.line + s.body).join('')

/** Keys of `params` that name a known section (null/undefined = not passed). */
export const passedKeys = (params: MemoryParams) => MEMORY_KEYS.filter(k => params[k] != null)

/**
 * New MEMORY.md: each passed field replaces its section's body; everything else stays byte-identical.
 * Missing sections are inserted in template order; an empty `current` renders the full template.
 * Throws when no known field is passed. `stamp` = "YYYY-MM-DD at HH:MM" (built by the caller).
 */
export function mergeMemory(current: string, params: MemoryParams, stamp: string): string {
  const keys = passedKeys(params)
  if (!keys.length) throw new Error(`Nothing to update: pass at least one of ${MEMORY_KEYS.join(', ')}`)
  const p = params as Record<string, unknown>

  if (!current.trim()) {
    return `# Project Memory\n**Last updated:** ${stamp}\n\n` +
      SECTIONS.map(([k, h, render]) => `## ${h}\n${demoteHeadings(render(p[k] ?? EMPTY[k]))}\n`).join('\n')
  }

  const doc = parseMemory(current)
  const find = (heading: string) => doc.sections.findIndex(s => s.heading.trim().toLowerCase() === heading.toLowerCase())
  SECTIONS.forEach(([k, heading, render], order) => {
    if (p[k] == null) return
    const content = demoteHeadings(render(p[k])).replace(/\s+$/, '')
    const at = find(heading)
    if (at >= 0) {
      const s = doc.sections[at]
      const eol = s.body.startsWith('\r\n') ? '\r\n' : '\n'
      s.body = `${eol}${content.replace(/\r?\n/g, eol)}${/(\r?\n)*$/.exec(s.body)?.[0] || eol}`
      return
    }
    // after the last template section before it; else before the first one after it; else at the end
    const before = SECTIONS.slice(0, order).map(([, h]) => find(h)).filter(i => i >= 0)
    const after = SECTIONS.slice(order + 1).map(([, h]) => find(h)).filter(i => i >= 0)
    const idx = before.length ? Math.max(...before) + 1 : after.length ? Math.min(...after) : doc.sections.length
    const last = idx === doc.sections.length
    // the text above the new heading must end in a blank line
    const eol = current.includes('\r\n') ? '\r\n' : '\n'
    const prev = idx > 0 ? doc.sections[idx - 1] : null
    if (prev) prev.body = prev.body.replace(/(\r?\n)*$/, eol + eol)
    else if (doc.preamble) doc.preamble = doc.preamble.replace(/(\r?\n)*$/, eol + eol)
    doc.sections.splice(idx, 0, { heading, line: `## ${heading}`, body: `${eol}${content.replace(/\r?\n/g, eol)}${eol}${last ? '' : eol}` })
  })

  // stamp: replace **Last updated:**, else insert under the H1, else on top — never inside a fence
  const stampLine = `**Last updated:** ${stamp}`
  const pre = doc.preamble.split(/(?<=\n)/)
  const fenced = fenceFlags(pre)
  const at = (re: RegExp) => pre.findIndex((l, i) => !fenced[i] && re.test(l))
  const last = at(/^\*\*Last updated:\*\*/), h1 = at(/^# /)
  if (last >= 0) pre[last] = stampLine + (/\r?\n$/.exec(pre[last])?.[0] ?? '')
  else if (h1 >= 0) pre[h1] = pre[h1].replace(/(\r?\n)?$/, eol => `${eol || '\n'}${stampLine}${eol}`)
  else pre.unshift(`${stampLine}\n`)
  doc.preamble = pre.join('')
  return joinMemory(doc)
}
