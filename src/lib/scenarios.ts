// Epic scenarios (R068): an epic states its promise as numbered WHEN/THEN scenarios in its body, and a task says
// which ones it covers with a `**Covers:** S1, S3` meta line. Ids are linked, never text-matched.
// Pure (no fs): core.ts reads the files. Self-check: node src/lib/scenarios.check.mts
//
//   ## Scenarios
//   ### S1: Break down an epic with scenarios
//   - WHEN the user breaks down an epic with three scenarios
//   - THEN every scenario is covered by at least one task

export type Scenario = { id: string; name: string; text: string }

const SCENARIOS_HEADING = /^##\s+Scenarios\s*$/i
const SCENARIO = /^###\s+(S\d+)\s*[:—–-]\s*(.+?)\s*$/i

/** Lines inside ``` fences, so a quoted example is never taken for the real section. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

/** "s01" → "S1" */
const normalizeId = (id: string) => `S${Number(id.slice(1))}`

/** The `## Scenarios` section of an epic body → scenarios in order; a repeated id keeps the first one. */
export function parseScenarios(body: string): Scenario[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const code = fenced(lines)
  const start = lines.findIndex((l, i) => !code[i] && SCENARIOS_HEADING.test(l.trim()))
  if (start < 0) return []
  const out: { id: string; name: string; text: string[] }[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (!code[i] && /^##\s/.test(lines[i])) break
    const m = code[i] ? null : SCENARIO.exec(lines[i].trim())
    if (m) {
      const id = normalizeId(m[1])
      out.push({ id, name: m[2], text: [] })
      continue
    }
    out.at(-1)?.text.push(lines[i])
  }
  const seen = new Set<string>()
  return out
    .filter(s => !seen.has(s.id) && seen.add(s.id))
    .map(s => ({ id: s.id, name: s.name, text: s.text.join('\n').trim() }))
}

/** `**Covers:** S1, s3 S3` → ['S1', 'S3']; anything that isn't an S-id is ignored. */
export function parseCovers(v: string | undefined): string[] {
  return [...new Set((v ?? '').match(/\bS\d+\b/gi)?.map(normalizeId) ?? [])]
}

/** Scenario id → the given tasks that cover it (in task order). */
export function coverageOf(scenarios: Scenario[], tasks: { id: string; covers: string[] }[]): Record<string, string[]> {
  return Object.fromEntries(scenarios.map(s => [s.id, tasks.filter(t => t.covers.includes(s.id)).map(t => t.id)]))
}

/** One checklist step per scenario: "S2 — WHEN a → THEN b" (bullet marks dropped, AND lines kept with their part). */
export function scenarioStep(sc: Scenario): string {
  const lines = sc.text.split('\n').map(l => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean)
  const then = lines.findIndex(l => /^THEN\b/i.test(l))
  const text = then > 0 ? `${lines.slice(0, then).join(' ')} → ${lines.slice(then).join(' ')}` : lines.join(' ')
  return `${sc.id} — ${text || sc.name}`
}

/** The seed `## Manual tests` report for a task covering `ids` (in the epic's order); '' when none match. */
export function seedSteps(scenarios: Scenario[], ids: string[]): string {
  const picked = scenarios.filter(sc => ids.includes(sc.id))
  return picked.length ? ['### Steps', ...picked.map(sc => `- [ ] ${scenarioStep(sc)}`)].join('\n') : ''
}
