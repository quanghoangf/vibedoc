// Pure capability specs (R066, no fs): `docs/specs/<capability>.md`, OpenSpec-style headings, nothing mandatory.
// `### Requirement: <name>` + a SHALL/MUST sentence, then `#### Scenario: <name>` with `- WHEN …` / `- THEN …` bullets.
// Self-check: node src/lib/specs.check.mts

export type SpecScenario = { name: string; text: string }
export type SpecRequirement = { name: string; text: string; scenarios: SpecScenario[] }
export type Spec = { capability: string; title: string; purpose: string; requirements: SpecRequirement[] }

const SPEC_PATH_RE = /^docs\/specs\/([^/]+)\.md$/

/** `docs/specs/<slug>.md`, no subfolders. */
export function isSpecPath(p: string): boolean {
  return SPEC_PATH_RE.test(p.replace(/\\/g, '/').replace(/^\.?\//, ''))
}

/** Lines inside ``` fences, so an example requirement quoted in a code block is never taken for a real one. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

const join = (ls: string[]) => ls.join('\n').trim()

/** Title = H1, purpose = the `## Purpose` section (else the prose before the first `##`), then requirements + scenarios. */
export function parseSpec(path: string, raw: string): Spec {
  const p = path.replace(/\\/g, '/').replace(/^\.?\//, '')
  const capability = SPEC_PATH_RE.exec(p)?.[1] ?? (p.split('/').pop() ?? p).replace(/\.md$/i, '')
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const code = fenced(lines)
  let title = ''
  const intro: string[] = []
  const purpose: string[] = []
  const requirements: SpecRequirement[] = []
  let req: { name: string; text: string[]; scenarios: { name: string; text: string[] }[] } | null = null
  let scenario: { name: string; text: string[] } | null = null
  let section: 'intro' | 'purpose' | 'other' | 'req' | 'scenario' = 'intro'
  const flush = () => {
    if (req) requirements.push({ name: req.name, text: join(req.text), scenarios: req.scenarios.map(s => ({ name: s.name, text: join(s.text) })) })
    req = null
    scenario = null
  }
  lines.forEach((l, i) => {
    const h = code[i] ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l)
    if (h) {
      const depth = h[1].length
      const text = h[2]
      let m: RegExpExecArray | null
      if (depth === 1 && !title) { title = text; return }
      if (depth === 3 && (m = /^Requirement:\s*(.+)$/i.exec(text))) {
        flush()
        req = { name: m[1].trim(), text: [], scenarios: [] }
        section = 'req'
        return
      }
      if (depth === 4 && req && (m = /^Scenario:\s*(.+)$/i.exec(text))) {
        scenario = { name: m[1].trim(), text: [] }
        req.scenarios.push(scenario)
        section = 'scenario'
        return
      }
      // a heading at the requirement's level or above ends it; a deeper non-scenario heading stays inside
      if (depth <= 3) {
        flush()
        section = depth === 2 && /^purpose$/i.test(text) ? 'purpose' : 'other'
        return
      }
    }
    if (section === 'intro') intro.push(l)
    else if (section === 'purpose') purpose.push(l)
    else if (section === 'req') req?.text.push(l)
    else if (section === 'scenario') scenario?.text.push(l)
  })
  flush()
  return { capability, title: title || capability, purpose: join(purpose) || join(intro), requirements }
}
