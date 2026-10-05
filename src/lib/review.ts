// Review history on a task (R043): a `## Review` section at the end of the task file, one `### ` entry per outcome.
// Pure (no fs): core.ts writes the file; `node src/lib/review.check.mts` runs the self-check.
//
//   ## Review
//   ### 2026-10-01T11:00:00Z — changes requested
//   The plan card doesn't scroll when there are 10+ tasks.
//   ### 2026-10-02T09:30:00Z — approved
//
// R062: an entry may start with `Run <runId>` and per-step mark lines (formatReviewBody / parseReviewMarks):
//   - ❌ Step 3 "Click Save → toast shows" — failed: Timeout waiting for toast · screenshot 03-click-save.png

export const REVIEW_HEADING = "## Review"

export type ReviewOutcome = "approved" | "changes requested"

/**
 * Statuses each outcome may resolve: approve only a task waiting in review; send back from review or from done
 * (a failed run on finished work reopens it). Anything else is a 409 in the route.
 */
export const REVIEWABLE: Record<ReviewOutcome, readonly string[]> = {
  approved: ["review"],
  "changes requested": ["review", "done"],
}

export interface ReviewEntry {
  at: string
  outcome: ReviewOutcome
  /** The whole entry body (mark lines included): what the agent reads */
  note: string
  /** R062: the run the reviewer decided from (`Run <id>` line), when there was one */
  runId?: string
  /** R062: per-step marks in the body; [] for entries without any */
  marks: ReviewMark[]
}

/**
 * R062: one flagged step of a send back. `item` = the checklist item's index (file order, shown 1-based as
 * "Step N"); `step` = its text; `screenshot` = the run's file for it (`03-click-save.png`).
 */
export interface ReviewMark {
  item: number
  step: string
  /** R063 `unverified`: the step passed but didn't prove its item (no / trivial assertion, passes without the app) */
  kind: "doubt" | "failed" | "unverified"
  comment?: string
  screenshot?: string
}

export const REVIEW_MARK_KINDS = ["doubt", "failed", "unverified"] as const
const MARK_GLYPH = { failed: "❌", doubt: "⚠️", unverified: "❔" } as const
const RUN_LINE = /^Run (\d{8}T\d{6}Z)$/
const MARK_LINE = /^- (?:❌|⚠️|❔) Step (\d+) "(.*)" — (failed|doubt|unverified)(?:: (.*?))?(?: · screenshot ([\w.-]+\.png))?$/u
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim()

/**
 * The body of a review entry: `Run <id>`, one line per mark, then the free-text note after a blank line. Approve
 * passes `reviewed` (the run's step count) for an "All N steps reviewed" line instead of marks.
 */
export function formatReviewBody(note: string, runId: string | null, marks: ReviewMark[] = [], reviewed?: number): string {
  const head = [
    ...(runId ? [`Run ${runId}`] : []),
    ...marks.map((m) => `- ${MARK_GLYPH[m.kind]} Step ${m.item + 1} "${oneLine(m.step)}" — ${m.kind}` +
      (m.comment?.trim() ? `: ${oneLine(m.comment)}` : "") + (m.screenshot ? ` · screenshot ${m.screenshot}` : "")),
    ...(reviewed !== undefined && !marks.length ? [`All ${reviewed} steps reviewed`] : []),
  ]
  return [head.join("\n"), note.trim()].filter(Boolean).join("\n\n")
}

/** The marks (and run id) back out of an entry body; lines that aren't marks are ignored. */
export function parseReviewMarks(body: string): { runId?: string; marks: ReviewMark[] } {
  let runId: string | undefined
  const marks: ReviewMark[] = []
  for (const line of body.split("\n")) {
    const run = line.trim().match(RUN_LINE)
    if (run) { runId ??= run[1]; continue }
    const m = line.trim().match(MARK_LINE)
    if (!m) continue
    marks.push({
      item: Number(m[1]) - 1, step: m[2], kind: m[3] as ReviewMark["kind"],
      ...(m[4] ? { comment: m[4] } : {}), ...(m[5] ? { screenshot: m[5] } : {}),
    })
  }
  return { ...(runId ? { runId } : {}), marks }
}

/**
 * R062: a send back's marks for a card chip: counts per kind and the step names in checklist order, at most
 * `max` named (`more` = how many were left out).
 */
export function summarizeMarks(marks: ReviewMark[], max = 3): { failed: number; doubt: number; steps: string[]; more: number } {
  const sorted = [...marks].sort((a, b) => a.item - b.item)
  return {
    // An unverified step is a doubt the tooling raised: it counts with the reviewer's doubts on a card
    failed: marks.filter((m) => m.kind === "failed").length,
    doubt: marks.filter((m) => m.kind !== "failed").length,
    steps: sorted.slice(0, max).map((m) => m.step),
    more: Math.max(0, sorted.length - max),
  }
}

const ENTRY = /^###\s+(\S+)\s+—\s+(approved|changes requested)\s*$/

/** Lines inside ``` fences, so a quoted example is never taken for the real section. */
function fenced(lines: string[]): boolean[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) { inFence = !inFence; return true }
    return inFence
  })
}

function sectionRange(lines: string[]): [number, number] | null {
  const code = fenced(lines)
  const start = lines.findIndex((l, i) => !code[i] && l.trim() === REVIEW_HEADING)
  if (start < 0) return null
  const next = lines.findIndex((l, i) => i > start && !code[i] && /^##\s/.test(l))
  return [start, next < 0 ? lines.length : next]
}

/** Every review entry, oldest first. */
export function reviewHistory(raw: string): ReviewEntry[] {
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) return []
  const entries: ReviewEntry[] = []
  for (const line of lines.slice(range[0] + 1, range[1])) {
    const m = line.match(ENTRY)
    if (m) entries.push({ at: m[1], outcome: m[2] as ReviewOutcome, note: "", marks: [] })
    else if (entries.length) {
      const last = entries[entries.length - 1]
      last.note = last.note ? `${last.note}\n${line}` : line
    }
  }
  return entries.map((e) => {
    const note = e.note.trim()
    return { ...e, note, ...parseReviewMarks(note) }
  })
}

export function latestReview(raw: string): ReviewEntry | null {
  const all = reviewHistory(raw)
  return all[all.length - 1] ?? null
}

/**
 * Add an entry to the `## Review` section (created at the end of the file if missing; an existing one keeps its
 * place and grows). A note is required for "changes requested".
 */
export function appendReviewEntry(raw: string, outcome: ReviewOutcome, note: string, at: string): string {
  const text = note.trim()
  if (outcome === "changes requested" && !text) throw new Error("A note is required to send a task back")
  // "## " at the start of a note line would end the section early
  const body = text.split("\n").map((l) => (/^#{1,3}\s/.test(l) ? `\\${l}` : l)).join("\n")
  const entry = [`### ${at} — ${outcome}`, ...(body ? [body] : [])]
  const lines = raw.split("\n")
  const range = sectionRange(lines)
  if (!range) return `${raw.replace(/\s+$/, "")}\n\n${REVIEW_HEADING}\n${entry.join("\n")}\n`
  // Insert after the section's last non-empty line, before the blank lines that separate it from what follows
  let end = range[1]
  while (end > range[0] + 1 && !lines[end - 1].trim()) end--
  const out = [...lines.slice(0, end), ...entry, ...lines.slice(end)]
  const joined = out.join("\n")
  return range[1] === lines.length ? `${joined.replace(/\s+$/, "")}\n` : joined
}
