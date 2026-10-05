// Parses the CHANGELOG.md semantic-release writes into releases for the changelog page (R075). Pure: no fs.
export type GroupName = 'New' | 'Improved' | 'Fixed'
export interface Item { scope: string | null; text: string; commit: string | null }
export interface Release { version: string; date: string | null; compare: string | null; groups: { name: GroupName; items: Item[] }[] }

const ORDER: GroupName[] = ['New', 'Improved', 'Fixed']
const groupOf = (heading: string): GroupName =>
  /feature/i.test(heading) ? 'New' : /bug|fix/i.test(heading) ? 'Fixed' : 'Improved'

/** "**scope:** text (T154) ([099c654](url))" → scope, plain text, commit url. */
export function parseItem(line: string): Item {
  let rest = line.replace(/^\*\s+/, '')
  let scope: string | null = null
  const s = rest.match(/^\*\*([^*:]+):\*\*\s*/)
  if (s) { scope = s[1].trim(); rest = rest.slice(s[0].length) }
  const c = rest.match(/\s*\(\[[0-9a-f]{6,}\]\(([^)]+)\)\)\s*$/)
  const commit = c ? c[1] : null
  if (c) rest = rest.slice(0, c.index)
  const text = rest
    .replace(/\s*\((?:[TR]\d{3,}(?:[,\s–-]+[TR]?\d{3,})*)\)\s*$/, '') // trailing task / epic ids: (T154), (T093–T112)
    .replace(/\s*,?\s*closes\s+#\d+.*$/i, '')
    .replace(/^[TR]\d{3,}\s+/, '') // a leading task id: "T109 self-check …"
    .replace(/\[(@[\w-]+)\]\(https:\/\/github\.com\/[\w-]+\)/g, '$1') // GitHub's @mention autolinks
    .trim()
  // Capitalize a plain first word, never an identifier (vibedoc_get_frontend, /graph, package.json)
  const plain = /^[a-z]+(\s|$)/.test(text)
  return { scope, text: plain ? text.charAt(0).toUpperCase() + text.slice(1) : text, commit }
}

export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  let release: Release | null = null
  let group: GroupName = 'Improved'
  for (const line of md.split('\n')) {
    const h = line.match(/^#{1,2}\s+\[?(\d+\.\d+\.\d+[\w.-]*)\]?(?:\(([^)]+)\))?\s*(?:\((\d{4}-\d{2}-\d{2})\))?/)
    if (h) {
      release = { version: h[1], compare: h[2] ?? null, date: h[3] ?? null, groups: [] }
      releases.push(release)
      continue
    }
    if (!release) continue
    const g = line.match(/^###\s+(.+)/)
    if (g) { group = groupOf(g[1]); continue }
    if (/^\*\s+/.test(line)) {
      let target = release.groups.find((x) => x.name === group)
      if (!target) { target = { name: group, items: [] }; release.groups.push(target) }
      target.items.push(parseItem(line))
    }
  }
  for (const r of releases) r.groups.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name))
  return releases
}
