/**
 * A Run from VibeDoc (R061), pure: the reporter's `@@vibedoc {json}` stdout lines → events → the run's state,
 * which the server keeps per project and sends over SSE (`test_run`). No fs, no process.
 * Self-check: node src/lib/test-run-events.check.mts
 */

/** Must match the prefix in src/testing/vibedoc-reporter.ts (kept standalone: Playwright loads it on its own). */
export const RUN_LINE_PREFIX = '@@vibedoc '

/** R064: where an event comes from in a suite (spec path relative to the Playwright cwd, and its task). */
export type EventSource = { file?: string; taskId?: string | null }
export type RunEvent =
  | { type: 'begin'; tests: number }
  | ({ type: 'test-begin'; title: string; retry?: number } & EventSource)
  | ({ type: 'test-end'; title: string; status: string; retry?: number; outcome?: string } & EventSource)
  | ({ type: 'step-begin'; index: number; name: string; retry?: number } & EventSource)
  | ({ type: 'step-end'; index: number; name: string; status: 'passed' | 'failed'; error: string | null } & EventSource)
  | { type: 'end'; status: string }

/** `retried` (R065): the step failed on an earlier attempt and ran again on a Playwright retry */
export type RunStepState = { index: number; name: string; status: 'running' | 'passed' | 'failed'; error: string | null; retried?: boolean }
/**
 * `starting`: the app is being reused / started, Playwright not spawned yet. `checking` (R063): the run passed and
 * the spec runs again against a blank page (honesty check) before the verdict is final.
 */
export type RunPhase = 'starting' | 'running' | 'checking' | 'passed' | 'failed' | 'cancelled' | 'error'
export type RunState = {
  taskId: string
  spec: string
  state: RunPhase
  startedAt: string
  finishedAt: string | null
  steps: RunStepState[]
  /** Why it errored (setup failure, crash) */
  error: string | null
  /** Last output lines, kept once the run ends (failed / error) */
  tail: string | null
  /** The reporter's `end` status, when it got that far */
  result: string | null
  /** Tests Playwright found (reporter `begin`); 0 = the spec path matched nothing */
  tests: number | null
  /** R063: steps that passed again on a blank page; null = not checked (yet, failed, or the check errored) */
  blankPassed: string[] | null
  /** R065: tests that failed and then passed on a retry */
  flaky: number
}

/**
 * The spec path (relative to the repo root, as the task's checklist header stores it) relative to the app dir the
 * run starts in. null when it lies outside that dir or climbs out with `..`.
 */
export function specInApp(spec: string, appDir: string): string | null {
  const parts = spec.replace(/\\/g, '/').split('/').filter(p => p && p !== '.')
  if (!parts.length || parts.includes('..') || spec.startsWith('/')) return null
  const dir = appDir.replace(/\\/g, '/').split('/').filter(p => p && p !== '.')
  if (dir.some((d, i) => parts[i] !== d) || parts.length <= dir.length) return null
  return parts.slice(dir.length).join('/')
}

export const isRunning = (s: RunState | null) => s?.state === 'starting' || s?.state === 'running' || s?.state === 'checking'

export function newRunState(taskId: string, spec: string, now: string): RunState {
  return { taskId, spec, state: 'starting', startedAt: now, finishedAt: null, steps: [], error: null, tail: null, result: null, tests: null, blankPassed: null, flaky: 0 }
}

/** One stdout line → an event, or null for every other line (list reporter output, app logs). */
export function parseRunLine(line: string): RunEvent | null {
  const at = line.indexOf(RUN_LINE_PREFIX)
  if (at < 0) return null
  try {
    const e = JSON.parse(line.slice(at + RUN_LINE_PREFIX.length))
    const from: EventSource = {
      ...(typeof e?.file === 'string' ? { file: e.file } : {}),
      ...(typeof e?.taskId === 'string' || e?.taskId === null ? { taskId: e.taskId } : {}),
    }
    if (e?.type === 'begin' && Number.isInteger(e.tests)) return { type: 'begin', tests: e.tests }
    if ((e?.type === 'test-begin' || e?.type === 'test-end') && typeof e.title === 'string') {
      const retry = Number.isInteger(e.retry) ? { retry: e.retry as number } : {}
      return e.type === 'test-begin' ? { type: e.type, title: e.title, ...retry, ...from }
        : { type: e.type, title: e.title, status: String(e.status), ...retry, ...(typeof e.outcome === 'string' ? { outcome: e.outcome } : {}), ...from }
    }
    if (e?.type === 'step-begin' && Number.isInteger(e.index) && typeof e.name === 'string')
      return { type: e.type, index: e.index, name: e.name, ...(Number.isInteger(e.retry) ? { retry: e.retry as number } : {}), ...from }
    if (e?.type === 'step-end' && Number.isInteger(e.index) && typeof e.name === 'string' && (e.status === 'passed' || e.status === 'failed'))
      return { type: e.type, index: e.index, name: e.name, status: e.status, error: typeof e.error === 'string' ? e.error : null, ...from }
    if (e?.type === 'end' && typeof e.status === 'string') return { type: 'end', status: e.status }
  } catch {
    // a log line that happens to contain the prefix
  }
  return null
}

export function applyEvent(s: RunState, e: RunEvent): RunState {
  if (e.type === 'begin') return { ...s, tests: e.tests }
  if (e.type === 'end') return { ...s, result: e.status }
  // R065: a test whose retry passed after a failure is flaky (counted once, on its final attempt)
  if (e.type === 'test-end') return e.outcome === 'flaky' && e.status === 'passed' ? { ...s, flaky: s.flaky + 1 } : s
  if (e.type === 'test-begin') return s
  const before = s.steps.find(x => x.index === e.index)
  // A step running again on a retry (it failed before, or a later step did) keeps that history as `retried`
  const retried = before?.retried || (e.type === 'step-begin' && !!e.retry && !!before) || undefined
  const steps = s.steps.filter(x => x.index !== e.index)
  steps.push(e.type === 'step-begin'
    ? { index: e.index, name: e.name, status: 'running', error: null, ...(retried ? { retried } : {}) }
    : { index: e.index, name: e.name, status: e.status, error: e.error, ...(retried ? { retried } : {}) })
  steps.sort((a, b) => a.index - b.index)
  return { ...s, state: 'running', steps }
}

/**
 * The process is gone: cancelled wins; then the reporter's verdict (exit 1 = a failing test, not a crash);
 * no verdict = error with the tail. A step still `running` at the end failed (timeout, crash).
 */
export function finishRun(s: RunState, out: { code: number | null; cancelled: boolean; tail: string; now: string; error?: string }): RunState {
  const steps = s.steps.map(x => (x.status === 'running' ? { ...x, status: 'failed' as const } : x))
  const base = { ...s, steps, finishedAt: out.now }
  if (out.cancelled) return { ...base, state: 'cancelled', tail: null }
  if (out.error) return { ...base, state: 'error', error: out.error, tail: out.tail }
  if (s.tests === 0) return { ...base, state: 'error', error: `No tests found in ${s.spec}`, tail: out.tail }
  if (s.result === 'passed' && out.code === 0) return { ...base, state: 'passed', tail: null }
  if (s.result) return { ...base, state: 'failed', tail: out.tail }
  return { ...base, state: 'error', error: `Playwright exited with code ${out.code} before reporting a result`, tail: out.tail }
}

/** R063: a passed run goes on to the blank-app check (its steps and verdict stay as they are meanwhile). */
export function startChecking(s: RunState): RunState {
  return { ...s, state: 'checking', finishedAt: null }
}

/**
 * The blank pass is over. Its step events → the names that passed again; a cancel wins; a pass that never
 * reported (crash) leaves `blankPassed: null` and the run still passed.
 */
export function finishChecking(s: RunState, out: { cancelled: boolean; blankEvents: RunEvent[]; now: string }): RunState {
  if (out.cancelled) return { ...s, state: 'cancelled', finishedAt: out.now }
  const ended = out.blankEvents.filter((e): e is Extract<RunEvent, { type: 'step-end' }> => e.type === 'step-end')
  const reported = out.blankEvents.some(e => e.type === 'end')
  return { ...s, state: 'passed', finishedAt: out.now, blankPassed: reported ? ended.filter(e => e.status === 'passed').map(e => e.name) : null }
}
