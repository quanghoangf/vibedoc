// Manual test report on a task (R043): a `## Manual tests` checklist section at the end of the task file.
// Pure (no fs): core.ts reads/writes the file; `node src/lib/manual-tests.check.mts` runs the self-check.
//
//   ## Manual tests
//   _2026-10-01 — ai_
//   ### Steps
//   - [ ] Open /roadmap, click "Break down" on R043 → a chat opens titled with the epic
//   ### Regression risk
//   - [ ] Dragging a card between columns still works

export const MANUAL_TESTS_HEADING = "## Manual tests"

export type ManualTestGroup = "steps" | "regression"

export interface ManualTestItem {
  text: string
  checked: boolean
  group: ManualTestGroup
  /** Position among all checklist items in the section (T061 toggles by this) */
  index: number
}

export interface ManualTests {
  items: ManualTestItem[]
  total: number
  done: number
}

const ITEM = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/
const BULLET = /^\s*[-*]\s+(.*)$/

/** Lines inside ``` fences, so an example section quoted in a task's spec is never taken for the real one. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

/** [start, end) line range of the section: its heading up to the next `## ` heading or the end of the file. */
function sectionRange(lines: string[]): [number, number] | null {
  const code = fenced(lines)
  const start = lines.findIndex((l, i) => !code[i] && l.trim() === MANUAL_TESTS_HEADING)
  if (start < 0) return null
  const next = lines.findIndex((l, i) => i > start && !code[i] && /^##\s/.test(l))
  return [start, next < 0 ? lines.length : next]
}

/**
 * The report body as a checklist: `### ` group headings kept, every other non-empty line becomes `- [ ] …`
 * (plain text and plain bullets alike). Items before any heading go under `### Steps`.
 */
export function normalizeReport(report: string): string {
  const out: string[] = []
  for (const raw of report.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    if (/^\s*###\s/.test(line)) { out.push(line.trim()); continue }
    if (/^\s*##?\s/.test(line)) continue // a stray "## Manual tests" or H1 from the agent
    const item = line.match(ITEM)
    const text = item ? item[2] : (line.match(BULLET)?.[1] ?? line.trim())
    if (!out.some((l) => l.startsWith("### "))) out.push("### Steps")
    out.push(`- [${item && item[1] !== " " ? "x" : " "}] ${text.trim()}`)
  }
  return out.join("\n")
}

/** Write the report as the task's `## Manual tests` section, replacing an older one (old ticks no longer apply). */
export function setManualTests(raw: string, report: string, actor: "ai" | "human", date: string): string {
  const body = normalizeReport(report)
  if (!body) throw new Error("manualTests is empty: give at least one checklist item")
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  const rest = range ? [...lines.slice(0, range[0]), ...lines.slice(range[1])] : lines
  const kept = rest.join("\n").replace(/\s+$/, "")
  return `${kept}\n\n${MANUAL_TESTS_HEADING}\n_${date} — ${actor}_\n${body}\n`
}

/** The checklist in a task file, or null when it has no `## Manual tests` section (or the section has no items). */
export function parseManualTests(raw: string): ManualTests | null {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) return null
  const items: ManualTestItem[] = []
  let group: ManualTestGroup = "steps"
  for (const line of lines.slice(range[0] + 1, range[1])) {
    if (/^\s*###\s/.test(line)) { group = /^\s*###\s+regression/i.test(line) ? "regression" : "steps"; continue }
    const m = line.match(ITEM)
    if (m) items.push({ text: m[2].trim(), checked: m[1] !== " ", group, index: items.length })
  }
  if (!items.length) return null
  return { items, total: items.length, done: items.filter((i) => i.checked).length }
}
