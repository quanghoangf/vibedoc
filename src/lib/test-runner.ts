/**
 * A Run from VibeDoc (R061): one task's Playwright spec at a time per project, spawned in its own process group
 * with VibeDoc's reporter, its `@@vibedoc` lines folded into a RunState (test-run-events.ts) and handed to
 * `onChange` (the route turns it into SSE). Process handling only, no fs; state lives on globalThis like the
 * frontend servers, so a hot reload or a second request never starts two runs.
 */

import { spawn, type ChildProcess } from 'child_process'
import { applyEvent, finishChecking, finishRun, isRunning, newRunState, parseRunLine, startChecking, type RunEvent, type RunState } from './test-run-events'
import { applySuiteEvent, finishSuite, isSuiteRunning, newSuiteState, type SuiteEntry, type SuiteState } from './suite'

const TAIL_LINES = 40

/** One entry per project: a single-task Run or the regression suite (R064) share the one-at-a-time lock. */
type Entry = { state: RunState | SuiteState; child: ChildProcess | null; cancelled: boolean }
const isSuite = (s: RunState | SuiteState): s is SuiteState => (s as SuiteState).kind === 'suite'
const going = (s: RunState | SuiteState) => (isSuite(s) ? isSuiteRunning(s) : isRunning(s))
const g = globalThis as unknown as { vibedocTestRuns?: Map<string, Entry>; vibedocTestRunsExitHook?: boolean }
const runs = g.vibedocTestRuns ?? (g.vibedocTestRuns = new Map())

if (!g.vibedocTestRunsExitHook) {
  g.vibedocTestRunsExitHook = true
  process.once('exit', () => { for (const e of runs.values()) killGroup(e.child) })
}

function killGroup(child: ChildProcess | null, signal: NodeJS.Signals = 'SIGTERM') {
  if (!child?.pid) return
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal) // npx → node → browsers: the whole group
  } catch {
    // already gone
  }
}

/** The project's current or last single-task run (kept until the next start); null when the last was a suite. */
export function runState(root: string): RunState | null {
  const s = runs.get(root)?.state
  return s && !isSuite(s) ? s : null
}

/** R064: the project's current or last suite. */
export function suiteState(root: string): SuiteState | null {
  const s = runs.get(root)?.state
  return s && isSuite(s) ? s : null
}

/** What holds the project's one-run lock right now, for a 409 message; null = free. */
export function busyWith(root: string): string | null {
  const s = runs.get(root)?.state
  if (!s || !going(s)) return null
  return isSuite(s) ? 'The regression suite is running' : `A run is already going: ${s.taskId}`
}

/** One Playwright pass in its own process group: reporter events → `onEvent`, other output → `lines` (tail). */
function spawnPass(entry: Entry, cwd: string, args: string[], env: Record<string, string>, onEvent: (e: RunEvent) => void, lines: string[]) {
  return new Promise<{ code: number | null; error?: string }>((resolve) => {
    const child = spawn('npx', ['playwright', 'test', ...args], {
      cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, FORCE_COLOR: '0', CI: '' },
    })
    entry.child = child
    let partial = ''
    const onData = (c: Buffer) => {
      const parts = (partial + c.toString('utf8')).split('\n')
      partial = parts.pop() ?? ''
      for (const l of parts) {
        const e = parseRunLine(l)
        if (e) onEvent(e)
        else if (l.trim()) {
          lines.push(l)
          if (lines.length > TAIL_LINES) lines.shift()
        }
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    let error: string | undefined
    child.on('error', e => { error = e.message })
    child.on('close', code => {
      killGroup(child, 'SIGKILL') // browsers it left behind
      resolve({ code, error })
    })
  })
}

/** `blankEnv` (R063): after a passing run, a second pass with these extra env vars (VIBEDOC_BLANK=1); none = skip. */
export type Prepared = { cwd: string; specRel: string; reporter: string; env?: Record<string, string>; blankEnv?: Record<string, string>; done?: () => void }

/**
 * Starts a run and returns its first state (`starting`). `prepare` makes the app reachable (reuse or start it)
 * and resolves the spec; it may throw → `error`. `done` runs after the process ends (stop an app we started).
 * Throws when this project already has a run going.
 */
export function startRun(opts: { root: string; taskId: string; spec: string; prepare: () => Promise<Prepared>; onChange: (s: RunState) => void }): RunState {
  const { root, taskId, spec, prepare, onChange } = opts
  const busy = busyWith(root)
  if (busy) throw new Error(busy)
  const state = newRunState(taskId, spec, new Date().toISOString())
  const entry: Entry = { state, child: null, cancelled: false }
  runs.set(root, entry)
  let cur = state
  const set = (s: RunState) => { cur = s; entry.state = s; onChange(s) }
  const lines: string[] = []
  const tail = () => lines.join('\n').trimEnd()

  void (async () => {
    let prepared: Prepared
    try {
      prepared = await prepare()
    } catch (e) {
      const out = (e as { output?: string }).output
      return set(finishRun(cur, { code: null, cancelled: entry.cancelled, tail: out ?? '', now: new Date().toISOString(), error: (e as Error).message }))
    }
    if (entry.cancelled) {
      prepared.done?.()
      return set(finishRun(cur, { code: null, cancelled: true, tail: '', now: new Date().toISOString() }))
    }
    const args = [prepared.specRel, `--reporter=list,${prepared.reporter}`]
    const pass = (env: Record<string, string> | undefined, onEvent: (e: RunEvent) => void) =>
      spawnPass(entry, prepared.cwd, args, { ...prepared.env, ...env }, onEvent, lines)

    const first = await pass(undefined, e => set(applyEvent(cur, e)))
    const verdict = finishRun(cur, { code: first.code, cancelled: entry.cancelled, tail: tail(), now: new Date().toISOString(), error: first.error })
    if (verdict.state !== 'passed' || !prepared.blankEnv) {
      prepared.done?.()
      return set(verdict)
    }
    // R063: the same spec against a blank page; whatever passes again proves nothing about the app
    set(startChecking(verdict))
    const blankEvents: RunEvent[] = []
    await pass(prepared.blankEnv, e => { blankEvents.push(e) })
    prepared.done?.()
    set(finishChecking(cur, { cancelled: entry.cancelled, blankEvents, now: new Date().toISOString() }))
  })()

  return state
}

/**
 * R064: every done task's spec in one Playwright process (VIBEDOC_TASK_MAP routes each spec's run to its task).
 * Same lock, prepare / done and cancel as a single Run; no blank-page pass. Throws when the project is busy.
 */
export function startSuite(opts: { root: string; entries: SuiteEntry[]; skipped: number; prepare: () => Promise<Omit<Prepared, 'specRel' | 'blankEnv'>>; onChange: (s: SuiteState) => void }): SuiteState {
  const { root, entries, skipped, prepare, onChange } = opts
  const busy = busyWith(root)
  if (busy) throw new Error(busy)
  const state = newSuiteState(entries, skipped, new Date().toISOString())
  const entry: Entry = { state, child: null, cancelled: false }
  runs.set(root, entry)
  let cur = state
  const set = (s: SuiteState) => { cur = s; entry.state = s; onChange(s) }
  const lines: string[] = []
  const now = () => new Date().toISOString()

  void (async () => {
    let prepared: Omit<Prepared, 'specRel' | 'blankEnv'>
    try {
      prepared = await prepare()
    } catch (e) {
      return set(finishSuite(cur, { code: null, cancelled: entry.cancelled, tail: (e as { output?: string }).output ?? '', now: now(), error: (e as Error).message }))
    }
    if (entry.cancelled) {
      prepared.done?.()
      return set(finishSuite(cur, { code: null, cancelled: true, tail: '', now: now() }))
    }
    const map = JSON.stringify(Object.fromEntries(entries.map(e => [e.specRel, e.taskId])))
    // ponytail: every spec on one command line; fine for ~100 specs, chunk into several passes beyond that
    const out = await spawnPass(entry, prepared.cwd, [...entries.map(e => e.specRel), `--reporter=list,${prepared.reporter}`],
      { ...prepared.env, VIBEDOC_TASK_MAP: map }, e => set(applySuiteEvent(cur, e)), lines)
    prepared.done?.()
    set(finishSuite(cur, { code: out.code, cancelled: entry.cancelled, tail: lines.join('\n').trimEnd(), now: now(), error: out.error }))
  })()

  return state
}

/** Stops the project's run or suite. False when nothing is running. */
export function cancelRun(root: string): boolean {
  const entry = runs.get(root)
  if (!entry || !going(entry.state)) return false
  entry.cancelled = true
  killGroup(entry.child)
  return true
}
