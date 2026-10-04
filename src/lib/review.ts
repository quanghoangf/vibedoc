// Review history on a task (R043): a `## Review` section at the end of the task file, one `### ` entry per outcome.
// Pure (no fs): core.ts writes the file; `node src/lib/review.check.mts` runs the self-check.
//
//   ## Review
//   ### 2026-10-01T11:00:00Z — changes requested
//   The plan card doesn't scroll when there are 10+ tasks.
//   ### 2026-10-02T09:30:00Z — approved

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
  note: string
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
    if (m) entries.push({ at: m[1], outcome: m[2] as ReviewOutcome, note: "" })
    else if (entries.length) {
      const last = entries[entries.length - 1]
      last.note = last.note ? `${last.note}\n${line}` : line
    }
  }
  return entries.map((e) => ({ ...e, note: e.note.trim() }))
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
