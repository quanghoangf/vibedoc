/**
 * Regression suite (R064), pure: every done task's spec in one Playwright process, folded per task from the
 * reporter's events (each carries its `taskId`, via VIBEDOC_TASK_MAP). No fs, no process, type-only imports.
 * Self-check: node src/lib/suite.check.mts
 */

import type { RunEvent } from './test-run-events'

export type SuiteEntry = { taskId: string; title: string; specRel: string }
/** `flaky` (R065): every test passed, at least one only on a retry; counts as passed */
export type SuiteTaskStatus = 'queued' | 'running' | 'passed' | 'flaky' | 'failed'
export type SuiteTask = SuiteEntry & {
  status: SuiteTaskStatus
  /** R065: each test's latest outcome (a retry replaces its failed attempt), keyed by title */
  outcomes?: Record<string, 'passed' | 'failed' | 'flaky'>
  steps: number
  passed: number
  failedStep: { index: number; name: string; error: string | null } | null
}
export type SuitePhase = 'starting' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error'
export type SuiteState = {
  kind: 'suite'
  state: SuitePhase
  startedAt: string
  endedAt: string | null
  tasks: SuiteTask[]
  /** Done tasks without a spec (not in the suite) */
  skipped: number
  error: string | null
  tail: string | null
  /** The reporter's `end` status, when it got that far */
  result: string | null
}

export const isSuiteRunning = (s: SuiteState | null) => s?.state === 'starting' || s?.state === 'running'

/**
 * The suite: done tasks with a spec, by task id. `toRel` maps a spec (repo-relative) to the Playwright cwd
 * (null = outside the app dir → `outside`). Done tasks without a spec only count as `skipped`.
 */
export function collectSuite(
  tasks: { id: string; title: string; status: string; manualTests: { spec: string | null } | null }[],
  toRel: (spec: string) => string | null,
): { entries: SuiteEntry[]; skipped: number; outside: { taskId: string; spec: string }[] } {
  const entries: SuiteEntry[] = []
  const outside: { taskId: string; spec: string }[] = []
  let skipped = 0
  for (const t of tasks) {
    if (t.status !== 'done') continue
    const spec = t.manualTests?.spec
    if (!spec) { skipped++; continue }
    const specRel = toRel(spec)
    if (specRel) entries.push({ taskId: t.id, title: t.title, specRel })
    else outside.push({ taskId: t.id, spec })
  }
  entries.sort((a, b) => a.taskId.localeCompare(b.taskId, undefined, { numeric: true }))
  return { entries, skipped, outside }
}

export function newSuiteState(entries: SuiteEntry[], skipped: number, now: string): SuiteState {
  return {
    kind: 'suite', state: 'starting', startedAt: now, endedAt: null, skipped, error: null, tail: null, result: null,
    tasks: entries.map(e => ({ ...e, status: 'queued', steps: 0, passed: 0, failedStep: null })),
  }
}

/** One reporter event → the task it names. Events without a known task only matter for `end`. */
export function applySuiteEvent(s: SuiteState, e: RunEvent): SuiteState {
  if (e.type === 'end') return { ...s, result: e.status }
  if (e.type === 'begin') return { ...s, state: 'running' }
  const at = s.tasks.findIndex(t => t.taskId === (e as { taskId?: string | null }).taskId)
  if (at < 0) return s
  const t = { ...s.tasks[at] }
  if (t.status === 'queued') t.status = 'running'
  if (e.type === 'step-end') {
    t.steps++
    if (e.status === 'passed') t.passed++
    else t.failedStep ??= { index: e.index, name: e.name, error: e.error }
  }
  // A task fails if any of its tests does; it passes once a test ends well and nothing failed
  if (e.type === 'test-end') {
    // Playwright's outcome so far: 'unexpected' (failed; a retry may still come), 'flaky' (failed, then passed),
    // 'expected' / 'skipped'. A later attempt of the same test replaces the earlier one.
    const o = e.outcome === 'flaky' ? 'flaky' : e.outcome === 'unexpected' ? 'failed' : e.outcome ? 'passed'
      : e.status === 'passed' || e.status === 'skipped' ? 'passed' : 'failed'
    t.outcomes = { ...t.outcomes, [e.title]: o }
    const all = Object.values(t.outcomes)
    t.status = all.includes('failed') ? 'failed' : all.includes('flaky') ? 'flaky' : 'passed'
    if (o !== 'failed') t.failedStep = all.includes('failed') ? t.failedStep : null
  }
  const tasks = s.tasks.slice()
  tasks[at] = t
  return { ...s, state: 'running', tasks }
}

/** The process is gone: cancel wins; then any failed task fails the suite; no verdict at all = error. */
export function finishSuite(s: SuiteState, out: { code: number | null; cancelled: boolean; tail: string; now: string; error?: string }): SuiteState {
  const base = { ...s, endedAt: out.now }
  if (out.cancelled) return { ...base, state: 'cancelled' }
  if (out.error) return { ...base, state: 'error', error: out.error, tail: out.tail }
  if (s.tasks.some(t => t.status === 'failed')) return { ...base, state: 'failed', tail: out.tail }
  // Flaky tasks count as passed (R065)
  if (s.result === 'passed' && out.code === 0) return { ...base, state: 'passed' }
  return { ...base, state: 'error', error: `Playwright exited with code ${out.code} before reporting a result`, tail: out.tail }
}
