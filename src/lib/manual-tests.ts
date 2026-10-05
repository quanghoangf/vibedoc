// Manual test report on a task (R043): a `## Manual tests` checklist section at the end of the task file.
// Pure (no fs): core.ts reads/writes the file; `node src/lib/manual-tests.check.mts` runs the self-check.
//
//   ## Manual tests
//   _2026-10-01 — ai · Spec: `e2e/vibedoc/T140-foo.spec.ts` · Auto: passed 2026-10-04_
//   ### Steps
//   - [ ] Open /roadmap, click "Break down" on R043 → a chat opens titled with the epic
//   - [ ] 🤖 Open / → board loads          (R058: automated, covered by the spec)
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
  /** `🤖 ` prefix (stripped from text): covered by the section's Playwright spec */
  auto: boolean
}

export type AutoResult = "passed" | "failed"
/** `unverified` (R063): passed steps that don't prove their item (no / trivial assertion, pass on a blank page) */
/** `flaky` (R065): tests that failed and then passed on a retry */
export interface AutoRun { result: AutoResult; date: string; unverified?: number; flaky?: number }

export interface ManualTests {
  items: ManualTestItem[]
  total: number
  done: number
  /** Items marked 🤖 */
  auto: number
  /** From the `_YYYY-MM-DD — actor_` line; null if missing */
  date: string | null
  /** `Spec: \`path\`` in the header line (relative to the target repo); null if none */
  spec: string | null
  /** `Auto: passed|failed YYYY-MM-DD` in the header line; null if never run */
  autoRun: AutoRun | null
}

/** Header extras: undefined keeps the current value (header-only update), null removes it. */
export interface ManualTestsMeta {
  spec?: string | null
  autoRun?: AutoRun | null
}

const ITEM = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/
const AUTO = /^🤖\s*/u
const STAMP = /^_(\d{4}-\d{2}-\d{2})\b/
const SPEC = / · Spec: `([^`]+)`/
const RUN = / · Auto: (passed|failed) (\d{4}-\d{2}-\d{2})(?: · (\d+) unverified)?(?: · (\d+) flaky)?/

function header(base: string, spec: string | null, autoRun: AutoRun | null): string {
  if (spec && (/[`\n]/.test(spec) || spec.startsWith("/") || spec.split(/[\\/]/).includes("..")))
    throw new Error(`spec must be a relative path inside the repo, got "${spec}"`)
  return `_${base}${spec ? ` · Spec: \`${spec}\`` : ""}${autoRun ? ` · Auto: ${autoRun.result} ${autoRun.date}${autoRun.unverified ? ` · ${autoRun.unverified} unverified` : ""}${autoRun.flaky ? ` · ${autoRun.flaky} flaky` : ""}` : ""}_`
}

function readHeader(line: string): { base: string; spec: string | null; autoRun: AutoRun | null } {
  const inner = line.trim().replace(/^_|_$/g, "")
  const spec = inner.match(SPEC)?.[1] ?? null
  const run = inner.match(RUN)
  return { base: inner.split(" · ")[0], spec, autoRun: run ? { result: run[1] as AutoResult, date: run[2], ...(run[3] ? { unverified: Number(run[3]) } : {}), ...(run[4] ? { flaky: Number(run[4]) } : {}) } : null }
}
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
export function setManualTests(raw: string, report: string, actor: "ai" | "human", date: string, meta: ManualTestsMeta = {}): string {
  const body = normalizeReport(report)
  if (!body) throw new Error("manualTests is empty: give at least one checklist item")
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  const rest = range ? [...lines.slice(0, range[0]), ...lines.slice(range[1])] : lines
  const kept = rest.join("\n").replace(/\s+$/, "")
  return `${kept}\n\n${MANUAL_TESTS_HEADING}\n${header(`${date} — ${actor}`, meta.spec ?? null, meta.autoRun ?? null)}\n${body}\n`
}

/**
 * Change only the spec / last run in the existing section's header line; items and ticks stay.
 * A section without a stamp line (hand-written) gets one from `actor` + `date`, so the parser can read it back.
 */
export function setManualTestsMeta(raw: string, meta: ManualTestsMeta, actor: "ai" | "human", date: string): string {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) throw new RangeError("This task has no manual tests: pass manualTests too")
  const at = range[0] + 1
  const has = at < range[1] && STAMP.test(lines[at])
  const cur = has ? readHeader(lines[at]) : { base: `${date} — ${actor}`, spec: null, autoRun: null }
  const next = header(cur.base, meta.spec === undefined ? cur.spec : meta.spec, meta.autoRun === undefined ? cur.autoRun : meta.autoRun)
  if (has) lines[at] = next
  else lines.splice(at, 0, next)
  return lines.join("\n")
}

/** The checklist in a task file, or null when it has no `## Manual tests` section (or the section has no items). */
export function parseManualTests(raw: string): ManualTests | null {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) return null
  const items: ManualTestItem[] = []
  let group: ManualTestGroup = "steps"
  let date: string | null = null
  let spec: string | null = null
  let autoRun: AutoRun | null = null
  for (const line of lines.slice(range[0] + 1, range[1])) {
    const stamp = line.match(STAMP)
    if (stamp && !date && !items.length) { date = stamp[1]; ({ spec, autoRun } = readHeader(line)); continue }
    if (/^\s*###\s/.test(line)) { group = /^\s*###\s+regression/i.test(line) ? "regression" : "steps"; continue }
    const m = line.match(ITEM)
    if (m) {
      const text = m[2].trim()
      const auto = AUTO.test(text)
      items.push({ text: auto ? text.replace(AUTO, "") : text, checked: m[1] !== " ", group, index: items.length, auto })
    }
  }
  if (!items.length) return null
  return {
    items, total: items.length, done: items.filter((i) => i.checked).length, auto: items.filter((i) => i.auto).length,
    date, spec, autoRun,
  }
}

/**
 * Unticked items a human still has to click through (R058): every manual one, and 🤖 ones unless the spec's last run passed.
 * `checked` lets the UI apply ticks it hasn't saved yet.
 */
export function untestedItems(t: Pick<ManualTests, "items" | "autoRun">, checked: (i: ManualTestItem) => boolean = (i) => i.checked): ManualTestItem[] {
  // R063: a pass with unverified steps proves only what it ticked; the unverified 🤖 items stay to check
  const proven = t.autoRun?.result === "passed" && !t.autoRun.unverified
  return t.items.filter((i) => !checked(i) && !(i.auto && proven))
}

/** Tick or untick the `index`th checklist item of the `## Manual tests` section (file order), nothing else. */
/**
 * Tick (or untick) every manual item of the section in one write; 🤖 items stay as they are (a run proves them).
 * Returns the indexes it changed, so a bulk undo can flip back exactly those. Throws RangeError without a section.
 */
export function setAllManualTests(raw: string, checked: boolean): { raw: string; changed: number[] } {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) throw new RangeError("This task has no manual tests")
  const changed: number[] = []
  let n = 0
  for (let i = range[0] + 1; i < range[1]; i++) {
    if (!ITEM.test(lines[i])) continue
    const index = n++
    if (/\[[ xX]\] 🤖/.test(lines[i]) || /\[[xX]\]/.test(lines[i]) === checked) continue
    lines[i] = lines[i].replace(/\[( |x|X)\]/, checked ? "[x]" : "[ ]")
    changed.push(index)
  }
  return { raw: lines.join("\n"), changed }
}

/** Tick (or untick) the given item indexes (file order) in one pass; unknown indexes are ignored. */
export function setManualTestsChecked(raw: string, indexes: number[], checked: boolean): string {
  if (!indexes.length) return raw
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) throw new RangeError("This task has no manual tests")
  const want = new Set(indexes)
  let n = 0
  for (let i = range[0] + 1; i < range[1]; i++) {
    if (!ITEM.test(lines[i])) continue
    if (want.has(n++)) lines[i] = lines[i].replace(/\[( |x|X)\]/, checked ? "[x]" : "[ ]")
  }
  return lines.join("\n")
}

export function toggleManualTest(raw: string, index: number, checked: boolean): string {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) throw new RangeError("This task has no manual tests")
  let n = 0
  for (let i = range[0] + 1; i < range[1]; i++) {
    if (!ITEM.test(lines[i])) continue
    if (n++ === index) {
      lines[i] = lines[i].replace(/\[( |x|X)\]/, checked ? "[x]" : "[ ]")
      return lines.join("\n")
    }
  }
  throw new RangeError(`No manual test item ${index} (the task has ${n})`)
}
