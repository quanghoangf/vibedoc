// R087: /llms.txt (llmstxt.org) built on request from the project's files. Pure: core.ts gathers the data.

export interface LlmsDoc { path: string; section: string; description?: string }
export interface LlmsSpec { path: string; title: string; purpose?: string }
export interface LlmsEpic { id: string; title: string; status: string; path: string }
export interface LlmsInput {
  title: string
  /** Prefix for links, e.g. "http://localhost:3333" */
  origin: string
  /** Appended to every link (e.g. "?root=…"), '' for none */
  query?: string
  docs: LlmsDoc[]
  specs: LlmsSpec[]
  epics: LlmsEpic[]
  /** `?section=`: list only this doc section */
  section?: string | null
}

/** Above this many docs the index lists sections (one level, `?section=`) instead of every doc. */
export const MAX_INLINE_DOCS = 150

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const item = (name: string, url: string, desc?: string) => `- [${name}](${url})${desc && oneLine(desc) ? `: ${oneLine(desc)}` : ''}`

export function formatLlmsTxt(input: LlmsInput): string {
  const { title, origin, docs, specs, epics, section } = input
  const qs = input.query ?? ''
  const md = (p: string) => `${origin}/md/${p.split('/').map(encodeURIComponent).join('/')}${qs}`
  const sectionUrl = (s: string) => `${origin}/llms.txt?section=${encodeURIComponent(s)}${qs.replace(/^\?/, '&')}`
  const bySection = new Map<string, LlmsDoc[]>()
  for (const d of docs) bySection.set(d.section, [...(bySection.get(d.section) ?? []), d])
  const docLines = (list: LlmsDoc[]) => list.map((d) => item(d.path, md(d.path), d.description))

  const out = [`# ${title}`, '', `> The project's docs, served by VibeDoc from its files. Every link returns that doc as plain markdown.`, '']

  if (section != null) {
    const list = bySection.get(section)
    if (!list) {
      out.push(`No section "${section}". Sections:`, ...[...bySection.keys()].map((s) => item(s, sectionUrl(s))))
      return out.join('\n') + '\n'
    }
    out.push(`## ${section}`, ...docLines(list))
    return out.join('\n') + '\n'
  }

  if (docs.length > MAX_INLINE_DOCS) {
    out.push('## Doc sections', ...[...bySection].map(([s, list]) => item(s, sectionUrl(s), `${list.length} docs`)), '')
  } else {
    for (const [s, list] of bySection) out.push(`## ${s}`, ...docLines(list), '')
  }
  if (specs.length) out.push('## Capability specs', ...specs.map((s) => item(s.title, md(s.path), s.purpose)), '')
  if (epics.length) out.push('## Open epics', ...epics.map((e) => item(`${e.id}: ${e.title}`, md(e.path), e.status)), '')
  return out.join('\n').trimEnd() + '\n'
}
