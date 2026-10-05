/**
 * Where test-run artifacts live (R059): `<runsRoot>/<project>/<taskId>/<runId>/`, outside every repo.
 * Pure (path + os only, no fs), shared by the Playwright fixture (`src/testing/playwright-fixture.ts`) and core.
 * Self-check: node src/lib/runs-paths.check.mts
 */

import os from 'os'
import path from 'path'

const SLUG_MAX = 60

/** `startMs` / `endMs`: offsets from the video's start (optional: runs recorded before they existed have none). */
/** `assertions` (R063): expects made inside the step, and how many looked at the page (absent before R063). */
export type RunStep = { index: number; name: string; status: 'passed' | 'failed'; screenshot: string | null; error: string | null; startMs?: number; endMs?: number; assertions?: { total: number; onPage: number } }
/** `run.json`: written by the fixture, read by the runs API/viewer and R060. Keep the shape stable. */
export type RunManifest = {
  runId: string; taskId: string; project: string; startedAt: string; endedAt: string
  status: 'passed' | 'failed'; commit: string | null; video: string | null; steps: RunStep[]
  /** R063: the blank-app check, from `honesty.json` next to run.json (never in run.json itself) */
  honesty?: RunHonesty
  /** R065: the Playwright test this run recorded and which attempt (0 = first); retries fold into one run dir */
  testId?: string
  retry?: number
  /** R065: per test, the final outcome over its attempts; absent before R065 (= one attempt, outcome from status) */
  tests?: RunTest[]
  /** R065: tests that failed and then passed on a retry */
  flaky?: number
}

/** R065: a test's outcome over Playwright's retries; `firstFailure` = what the first failing attempt showed. */
export type RunTest = {
  title: string
  outcome: 'passed' | 'failed' | 'flaky' | 'skipped'
  attempts: number
  firstFailure?: { step: string | null; error: string | null; screenshot: string | null }
}

/** R063 `honesty.json`: the steps that passed again with every page replaced by a blank one. */
export type RunHonesty = { checkedAt: string; blankPassed: string[] }

export function parseRunHonesty(text: string): RunHonesty | null {
  try {
    const h = JSON.parse(text)
    return h && typeof h.checkedAt === 'string' && Array.isArray(h.blankPassed) && h.blankPassed.every((n: unknown) => typeof n === 'string') ? h : null
  } catch {
    return null
  }
}

/** Input checks before anything is joined into a runs path (the runs API takes these from the URL). */
export const isRunId = (s: string) => /^\d{8}T\d{6}Z$/.test(s)
export const isRunFile = (s: string) => /^[\w.-]+\.(png|webm)$/.test(s) && !s.startsWith('.')
export const isRunTaskId = (s: string) => /^T\d+$/.test(s)
export const runFileType = (file: string) => (file.endsWith('.webm') ? 'video/webm' : 'image/png')

/** A parsed run.json, or null when it isn't one (half-written, hand-edited, another tool's file). */
export function parseRunManifest(text: string): RunManifest | null {
  try {
    const m = JSON.parse(text)
    return m && typeof m === 'object' && isRunId(String(m.runId)) && Array.isArray(m.steps) && (m.status === 'passed' || m.status === 'failed') ? m : null
  } catch {
    return null
  }
}

/**
 * `Range: bytes=…` → the inclusive byte span to send. null = send the whole file (no header, a multi-range or
 * a syntax we don't read); 'unsatisfiable' = 416. Covers `a-b`, `a-` and the suffix form `-n`.
 */
export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  const m = header?.trim().match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (!m[1] && !m[2])) return null
  if (!m[1]) {
    const n = Number(m[2])
    return n === 0 || size === 0 ? 'unsatisfiable' : { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(m[1])
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  return start >= size || end < start ? 'unsatisfiable' : { start, end }
}

/** `$VIBEDOC_RUNS_DIR`, else `~/.vibedoc/runs`. */
export function runsRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), '.vibedoc', 'runs')
}

/** Lowercase, non-alphanumerics → `-`, at most 60 chars, no leading/trailing `-`. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, SLUG_MAX).replace(/-+$/, '')
}

/** Project folder name: the slugged basename of the project root (`/work/My App` → `my-app`). */
export function projectKey(root: string): string {
  return slug(path.basename(path.resolve(root))) || 'project'
}

export function runDir(project: string, taskId: string, runId: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(runsRoot(env), project, taskId, runId)
}

/** Compact UTC timestamp, sorts lexically: 2026-10-04T10:15:00.123Z → `20261004T101500Z`. */
export function newRunId(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

/** Screenshot name for a step: `01-open-board-board-loads.png`. */
export function stepFile(index: number, name: string): string {
  return `${String(index).padStart(2, '0')}-${slug(name) || 'step'}.png`
}
