// Verification findings on a task (R067): what a finished task gets wrong against what was asked, one line each.
// Pure (no fs): core.ts writes the file; `node src/lib/verification.check.mts` runs the self-check.
//
//   ## Verification
//   _2026-10-06 — ai:claude-code · at 3f2a91c_
//   - [critical] AC2 "Unknown plan → 400" — route returns 500 · `src/app/api/checkout/route.ts:41`
//   - [minor] Scope "update the stale comment" — comment still says R060
//
// The section sits after `## Manual tests` and before `## Review` (appended when there is no Review). A new report
// replaces the old one; an empty findings list means "verified, nothing found".

export const VERIFICATION_HEADING = "## Verification"
export const SEVERITIES = ["critical", "major", "minor"] as const
export type Severity = (typeof SEVERITIES)[number]
export type Finding = { severity: Severity; criterion: string; message: string; file?: string }
/** `outdated`: set by core on read (never stored): a commit naming the task landed after `sha`. */
export type Verification = { at: string; by: string; sha?: string; findings: Finding[]; outdated?: boolean }

const NOTHING_FOUND = "Verified: nothing found."
const STAMP = /^_(\S+) — (.+?)(?: · at ([0-9a-f]{4,40}))?_$/
const FINDING = /^- \[(critical|major|minor)\] (.+?) — (.+?)(?: · `([^`]+)`)?$/
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim()

/** Lines inside ``` fences, so a quoted example is never taken for the real section. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

/** [start, end) of the section: its heading up to the next `## ` heading or the end of the file. */
function sectionRange(lines: string[]): [number, number] | null {
  const code = fenced(lines)
  const start = lines.findIndex((l, i) => !code[i] && l.trim() === VERIFICATION_HEADING)
  if (start < 0) return null
  const next = lines.findIndex((l, i) => i > start && !code[i] && /^##\s/.test(l))
  return [start, next < 0 ? lines.length : next]
}

// " — " separates criterion from message, so it can't appear inside the criterion
const findingLine = (f: Finding) =>
  `- [${f.severity}] ${oneLine(f.criterion).replace(/ — /g, " - ")} — ${oneLine(f.message)}${f.file ? ` · \`${oneLine(f.file).replace(/`/g, "")}\`` : ""}`

export function formatVerification(v: Verification): string {
  const stamp = `_${v.at} — ${v.by}${v.sha ? ` · at ${v.sha}` : ""}_`
  const rows = v.findings.map(findingLine)
  return [VERIFICATION_HEADING, stamp, ...(rows.length ? rows : [NOTHING_FOUND])].join("\n")
}

/** The send-back note for the findings a human picked (R067): one line each, in the section's own format. */
export function formatFindingsNote(findings: Finding[]): string {
  if (!findings.length) return ""
  return [`Fix ${findings.length === 1 ? "this verification finding" : `these ${findings.length} verification findings`}:`, ...findings.map(findingLine)].join("\n")
}

/**
 * True when a commit naming `taskId` landed after the report's `sha`. `log` = commits newest first (sha, subject).
 * No sha, or a sha not in `log` (another branch, history cut) → never outdated.
 */
export function isOutdated(sha: string | undefined, taskId: string, log: { sha: string; subject: string }[]): boolean {
  if (!sha) return false
  const at = log.findIndex((c) => c.sha.startsWith(sha))
  if (at < 0) return false
  const id = new RegExp(`\\b${taskId}\\b`)
  return log.slice(0, at).some((c) => id.test(c.subject))
}

/** The report in a task file, or null when it has no `## Verification` section (or the section has no stamp). */
export function parseVerification(raw: string): Verification | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n")
  const range = sectionRange(lines)
  if (!range) return null
  let head: Omit<Verification, "findings"> | null = null
  const findings: Finding[] = []
  for (const line of lines.slice(range[0] + 1, range[1])) {
    const s = line.trim().match(STAMP)
    if (s && !head) { head = { at: s[1], by: s[2], ...(s[3] ? { sha: s[3] } : {}) }; continue }
    const f = line.trim().match(FINDING)
    if (f) findings.push({ severity: f[1] as Severity, criterion: f[2], message: f[3], ...(f[4] ? { file: f[4] } : {}) })
  }
  return head ? { ...head, findings } : null
}

/** Replace the section (or add it): before an existing `## Review`, else at the end. Nothing else changes. */
export function setVerification(raw: string, v: Verification): string {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  const block = formatVerification(v).split("\n")
  if (range) {
    // keep the blank line(s) that separated it from the next section
    const tail = lines.slice(range[0], range[1])
    let blanks = 0
    while (blanks < tail.length && tail[tail.length - 1 - blanks].trim() === "") blanks++
    return [...lines.slice(0, range[0]), ...block, ...tail.slice(tail.length - blanks), ...lines.slice(range[1])].join("\n")
  }
  const code = fenced(lines)
  const review = lines.findIndex((l, i) => !code[i] && l.trim() === "## Review")
  if (review >= 0) return [...lines.slice(0, review), ...block, "", ...lines.slice(review)].join("\n")
  return `${raw.replace(/\s+$/, "")}\n\n${block.join("\n")}\n`
}

/** Findings from an MCP call, checked; a string is the error to show (it names the allowed severities). */
export function validateFindings(input: unknown): Finding[] | string {
  if (!Array.isArray(input)) return "findings must be an array (use [] for verified, nothing found)"
  const out: Finding[] = []
  for (const [i, f] of input.entries()) {
    const o = (f ?? {}) as Record<string, unknown>
    if (!SEVERITIES.includes(o.severity as Severity)) {
      return `findings[${i}].severity must be one of ${SEVERITIES.join(", ")} (got ${JSON.stringify(o.severity)})`
    }
    const criterion = typeof o.criterion === "string" ? oneLine(o.criterion) : ""
    const message = typeof o.message === "string" ? oneLine(o.message) : ""
    if (!criterion) return `findings[${i}].criterion is required: the acceptance criterion, scope item or rule it fails`
    if (!message) return `findings[${i}].message is required: what is missing or wrong`
    if (o.file !== undefined && typeof o.file !== "string") return `findings[${i}].file must be a string like "src/x.ts:41"`
    const file = typeof o.file === "string" ? oneLine(o.file) : ""
    out.push({ severity: o.severity as Severity, criterion, message, ...(file ? { file } : {}) })
  }
  return out
}

/** Critical + major: what the card badge counts. */
export const blockingCount = (v: Verification | null) => v ? v.findings.filter((f) => f.severity !== "minor").length : 0

export type VerifyContext = {
  taskId: string
  title: string
  sections: { heading: string; body: string }[]
  doneWhen: string
  relatedSpec: string
  conventions: { id: string; summary: string }[]
  commits: { sha: string; subject: string }[]
  diff: string
  /** diff lines left out to stay under the cap */
  diffCut: number
  head: string | null
}

/** Everything an agent needs to judge a finished task against what was asked (R067), plus how to report. */
export function formatVerifyContext(c: VerifyContext): string {
  const out = [`# Verify ${c.taskId}: ${c.title}`]
  for (const s of c.sections) out.push("", `## ${s.heading}`, s.body)
  if (c.doneWhen) out.push("", "## Epic Done when", c.doneWhen)
  if (c.relatedSpec) out.push("", c.relatedSpec)
  if (c.conventions.length) out.push("", "## Conventions", ...c.conventions.map((e) => `- ${e.id} · ${e.summary}`))
  out.push("", "## The change")
  if (c.commits.length) {
    out.push(...c.commits.map((k) => `- ${k.sha.slice(0, 7)} ${k.subject}`), "", "```diff", c.diff.trimEnd(), "```")
    if (c.diffCut) out.push(`(${c.diffCut} more diff lines cut; read them with git show <sha>)`)
  } else {
    out.push(`No commit mentions ${c.taskId}. Compare against the working tree instead: \`git status\` and \`git diff\` (and \`git diff --staged\`).`)
  }
  out.push("", "## How to verify",
    "- Check each acceptance criterion and scope item against the change above (read the files when the diff is not enough).",
    "- Report only real gaps, each with the criterion it fails and a file:line when there is one. Don't report style or test quality.",
    "- Severity: critical = a criterion is not met; major = wrong behaviour or a missed edge case; minor = polish.",
    `- Always finish with vibedoc_report_findings { taskId: "${c.taskId}", findings, sha${c.head ? `: "${c.head}"` : ""} }, with findings: [] when nothing is wrong.`)
  return out.join("\n")
}
