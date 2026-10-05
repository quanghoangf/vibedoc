/**
 * /manual-tests "Test review" table (pure): one row per task that has a checklist or a recorded run,
 * which tab it falls in, and the order. No React, no fs. Self-check: node src/lib/test-review.check.mts
 */

import type { ManualTestItem, AutoRun } from "./manual-tests"

export type RunResult = "passed" | "failed" | "none"
export type ReviewTab = "needs" | "failed" | "passed" | "flaky" | "none" | "all"
export const REVIEW_TABS: ReviewTab[] = ["needs", "failed", "passed", "flaky", "none", "all"]

export interface ReviewInput {
  id: string
  title: string
  phase: string
  status: string
  /** Parsed `## Manual tests` items (with the page's pending ticks applied), [] when none */
  items: ManualTestItem[]
  autoRun: AutoRun | null
  lastRun: { runId: string; status: "passed" | "failed"; steps: number; passed: number } | null
  reportDate: string | null
}

export interface ReviewRow {
  id: string
  title: string
  epic: { id: string | null; name: string }
  status: string
  manual: { done: number; total: number }
  auto: { total: number; result: RunResult }
  /** Newest recorded run, else the checklist's `Auto:` result */
  result: RunResult
  steps: { passed: number; total: number } | null
  /** ISO time of the newest run (or the report date): sorts the table and feeds "5h ago" */
  at: string | null
  /** Unticked items a human still owes: every manual one, 🤖 ones unless proven by a passed run */
  left: number
  /** R063: passed steps of the last recorded result that don't prove their item */
  unverified: number
  /** R065: tests of the last recorded result that passed only on a retry (shown, never counted as broken) */
  flaky: number
  /** A failed run, a task in review, or checks left on a task that isn't finished (see needsYou) */
  needsMe: boolean
}

/**
 * The one triage rule (the page's "Needs you" tab and the sidebar badge): the last run failed or passed with
 * unverified steps (R063), the task waits in review, or checks are left on a task that isn't done/cancelled.
 * Unticked checks on finished work don't count.
 */
export function needsYou(status: string, result: RunResult, left: number, unverified = 0): boolean {
  // R063: a pass that proves less than it claims (unverified steps) is as much your call as a failed one
  return result === "failed" || unverified > 0 || status === "review" || (left > 0 && status !== "done" && status !== "cancelled")
}

/** Sidebar badge from board tasks (no parsing): same rule, `untested` stands in for `left`. */
export function countNeedsYou(tasks: { status: string; manualTests: { untested: number; autoRun: { result: "passed" | "failed"; unverified?: number } | null } | null; lastRun: { status: "passed" | "failed" } | null }[]): number {
  return tasks.filter((t) => (t.manualTests || t.lastRun) &&
    needsYou(t.status, t.lastRun?.status ?? t.manualTests?.autoRun?.result ?? "none", t.manualTests?.untested ?? 0, t.manualTests?.autoRun?.unverified ?? 0)).length
}

/** `20261004T074314Z` → `2026-10-04T07:43:14Z` */
export function runIdTime(runId: string): string | null {
  const m = runId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null
}

/** "R057 — Frontend app detection" → { id: "R057", name: "Frontend app detection" } */
export function splitEpic(phase: string): { id: string | null; name: string } {
  const m = phase.match(/^(R\d+)\s*[—–-]\s*(.+)$/)
  return m ? { id: m[1], name: m[2] } : { id: null, name: phase || "No epic" }
}

export function toRow(t: ReviewInput): ReviewRow {
  const manual = t.items.filter((i) => !i.auto)
  const auto = t.items.filter((i) => i.auto)
  const result: RunResult = t.lastRun?.status ?? t.autoRun?.result ?? "none"
  // R063: a pass with unverified steps proves only the 🤖 items it ticked
  const proven = (t.lastRun?.status ?? t.autoRun?.result) === "passed" && !t.autoRun?.unverified
  const left = manual.filter((i) => !i.checked).length + (proven ? 0 : auto.filter((i) => !i.checked).length)
  return {
    id: t.id,
    title: t.title,
    epic: splitEpic(t.phase),
    status: t.status,
    manual: { done: manual.filter((i) => i.checked).length, total: manual.length },
    auto: { total: auto.length, result },
    result,
    steps: t.lastRun ? { passed: t.lastRun.passed, total: t.lastRun.steps } : null,
    at: (t.lastRun && runIdTime(t.lastRun.runId)) ?? t.autoRun?.date ?? t.reportDate,
    left,
    unverified: t.autoRun?.unverified ?? 0,
    flaky: t.autoRun?.result === "passed" ? t.autoRun.flaky ?? 0 : 0,
    needsMe: needsYou(t.status, result, left, t.autoRun?.unverified ?? 0),
  }
}

export function inTab(r: ReviewRow, tab: ReviewTab): boolean {
  if (tab === "needs") return r.needsMe
  if (tab === "all") return true
  if (tab === "flaky") return r.flaky > 0 // also under Passed: flaky is a passing result
  return r.result === tab
}

/** Failing first, then waiting in review, then newest activity; ties by id, newest task first. */
export function sortRows(rows: ReviewRow[]): ReviewRow[] {
  const rank = (r: ReviewRow) => (r.result === "failed" ? 0 : r.status === "review" ? 1 : 2)
  return [...rows].sort((a, b) =>
    rank(a) - rank(b) || (b.at ?? "").localeCompare(a.at ?? "") || b.id.localeCompare(a.id, undefined, { numeric: true }))
}

export function filterRows(rows: ReviewRow[], tab: ReviewTab, epic: string | null, q: string): ReviewRow[] {
  const needle = q.trim().toLowerCase()
  return rows.filter((r) =>
    inTab(r, tab) &&
    (!epic || r.epic.id === epic) &&
    (!needle || r.id.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle)))
}

/** What's still open at the decision point: ["3 checks unticked", "last run passed"] (shown joined with " · "). */
export function outstanding(r: ReviewRow, failedStep: number | null = null): [checks: string, run: string] {
  const checks = r.manual.total + r.auto.total
  const left = !checks ? "no checklist" : r.left ? `${r.left} ${r.left === 1 ? "check" : "checks"} unticked` : "all checks ticked"
  const run = r.result === "none" ? "no run yet"
    : r.result === "passed" ? `last run passed${r.unverified ? ` · ${r.unverified} unverified` : ""}`
    : failedStep ? `last run failed at step ${failedStep}` : "last run failed"
  return [left, run]
}

/**
 * The prefilled send-back note for a failed step: the step, then the first Expected/Received lines of its
 * error (else the error's first line). ANSI colour codes are stripped. The human edits it before sending.
 */
export function sendBackNote(step: { index: number; name: string; error: string | null }): string {
  const lines = (step.error ?? "").replace(/\x1b\[[0-9;]*m/g, "").split("\n").map((l) => l.trim()).filter(Boolean)
  const pick = ["Expected:", "Received:"].flatMap((k) => lines.find((l) => l.startsWith(k)) ?? [])
  const detail = pick.length ? pick : lines.slice(0, 1)
  return [`The last run failed at step ${step.index}: ${step.name}`, ...detail].join("\n")
}

export type StepPart = { kind: "text" | "code" | "strong"; text: string }

// An emoji with its variation selector / ZWJ sequence; status emoji never reach the UI (icons come from lucide)
const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*️?/gu
const INLINE = /(`[^`]+`|\*\*.+?\*\*)/

/**
 * A checklist item's text as runs: `code` spans (backticks dropped, kept verbatim), **bold**, and plain text
 * with emoji stripped outside code. The caller still sets paths/ids in plain runs in mono.
 */
export function stepParts(text: string): StepPart[] {
  const parts: StepPart[] = []
  for (const [i, raw] of text.split(INLINE).entries()) {
    if (i % 2) {
      if (raw.startsWith("`")) parts.push({ kind: "code", text: raw.slice(1, -1) })
      else parts.push({ kind: "strong", text: raw.slice(2, -2).replace(EMOJI, "").replace(/ {2,}/g, " ").trim() })
      continue
    }
    const plain = raw.replace(EMOJI, "").replace(/ {2,}/g, " ")
    if (plain) parts.push({ kind: "text", text: plain })
  }
  if (parts[0]?.kind === "text") parts[0].text = parts[0].text.trimStart()
  return parts.filter((p) => p.text)
}

/** A run clock: `m:ss`, or `m:ss.s` when the whole run is under 10s, so short steps don't all read 0:00. */
export function runClock(ms: number, totalMs: number): string {
  const tenths = totalMs < 10_000
  const t = Math.max(0, ms) / 1000
  const s = tenths ? Math.round(t * 10) / 10 : Math.round(t)
  const sec = s % 60
  return `${Math.floor(s / 60)}:${tenths ? sec.toFixed(1).padStart(4, "0") : String(sec).padStart(2, "0")}`
}

/**
 * Where each timed step sits on the video, clamped to its length: the last step's `endMs` (its screenshot)
 * can land after recording stops. `at` = the screenshot moment to seek to (just before the end).
 */
export function stepSpans(steps: { index: number; startMs?: number; endMs?: number }[], durationMs: number): { index: number; start: number; end: number; at: number }[] {
  const cap = (n: number) => (durationMs > 0 ? Math.min(n, durationMs) : n)
  return steps.map((s) => {
    const start = cap(s.startMs ?? 0)
    const end = Math.max(start, cap(s.endMs ?? start))
    return { index: s.index, start, end, at: Math.max(start, Math.min(end, (s.endMs ?? start) - 40, durationMs > 0 ? durationMs - 1 : Infinity)) }
  })
}

/** The step playing at `ms` (the later one on a shared boundary), or null outside every span. */
export function stepAt(spans: { index: number; start: number; end: number }[], ms: number): number | null {
  for (let i = spans.length - 1; i >= 0; i--) if (ms >= spans[i].start && ms <= spans[i].end) return spans[i].index
  return null
}

/** The polite live-region line for a selection change: "T138 · last run passed 2/2 · 5 checks left". */
export function selectionLabel(r: ReviewRow): string {
  const run = r.result === "none" ? "no run yet" : `last run ${r.result}${r.steps ? ` ${r.steps.passed}/${r.steps.total}` : ""}`
  const left = r.left ? `${r.left} ${r.left === 1 ? "check" : "checks"} left` : r.manual.total + r.auto.total ? "all checks ticked" : "no checklist"
  return `${r.id} · ${run} · ${left}`
}
