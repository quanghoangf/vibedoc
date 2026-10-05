/**
 * A Run from VibeDoc (R061): one task's Playwright spec at a time per project, spawned in its own process group
 * with VibeDoc's reporter, its `@@vibedoc` lines folded into a RunState (test-run-events.ts) and handed to
 * `onChange` (the route turns it into SSE). Process handling only, no fs; state lives on globalThis like the
 * frontend servers, so a hot reload or a second request never starts two runs.
 */

import { spawn, type ChildProcess } from 'child_process'
import { applyEvent, finishChecking, finishRun, isRunning, newRunState, parseRunLine, startChecking, type RunEvent, type RunState } from './test-run-events'

const TAIL_LINES = 40

type Entry = { state: RunState; child: ChildProcess | null; cancelled: boolean }
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

/** The project's current or last run (kept until the next start). */
export const runState = (root: string): RunState | null => runs.get(root)?.state ?? null

/** `blankEnv` (R063): after a passing run, a second pass with these extra env vars (VIBEDOC_BLANK=1); none = skip. */
export type Prepared = { cwd: string; specRel: string; reporter: string; env?: Record<string, string>; blankEnv?: Record<string, string>; done?: () => void }

/**
 * Starts a run and returns its first state (`starting`). `prepare` makes the app reachable (reuse or start it)
 * and resolves the spec; it may throw → `error`. `done` runs after the process ends (stop an app we started).
 * Throws when this project already has a run going.
 */
export function startRun(opts: { root: string; taskId: string; spec: string; prepare: () => Promise<Prepared>; onChange: (s: RunState) => void }): RunState {
  const { root, taskId, spec, prepare, onChange } = opts
  const current = runs.get(root)
  if (current && isRunning(current.state)) throw new Error(`A run is already going: ${current.state.taskId}`)
  const entry: Entry = { state: newRunState(taskId, spec, new Date().toISOString()), child: null, cancelled: false }
  runs.set(root, entry)
  const set = (s: RunState) => { entry.state = s; onChange(s) }
  const lines: string[] = []
  const tail = () => lines.join('\n').trimEnd()

  void (async () => {
    let prepared: Prepared
    try {
      prepared = await prepare()
    } catch (e) {
      const out = (e as { output?: string }).output
      return set(finishRun(entry.state, { code: null, cancelled: entry.cancelled, tail: out ?? '', now: new Date().toISOString(), error: (e as Error).message }))
    }
    if (entry.cancelled) {
      prepared.done?.()
      return set(finishRun(entry.state, { code: null, cancelled: true, tail: '', now: new Date().toISOString() }))
    }
    // One Playwright pass; its reporter events go to `onEvent`, other output to the tail
    const pass = (env: Record<string, string> | undefined, onEvent: (e: RunEvent) => void) => new Promise<{ code: number | null; error?: string }>((resolve) => {
      const child = spawn('npx', ['playwright', 'test', prepared.specRel, `--reporter=list,${prepared.reporter}`], {
        cwd: prepared.cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...prepared.env, ...env, FORCE_COLOR: '0', CI: '' },
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

    const first = await pass(undefined, e => set(applyEvent(entry.state, e)))
    const verdict = finishRun(entry.state, { code: first.code, cancelled: entry.cancelled, tail: tail(), now: new Date().toISOString(), error: first.error })
    if (verdict.state !== 'passed' || !prepared.blankEnv) {
      prepared.done?.()
      return set(verdict)
    }
    // R063: the same spec against a blank page; whatever passes again proves nothing about the app
    set(startChecking(verdict))
    const blankEvents: RunEvent[] = []
    await pass(prepared.blankEnv, e => { blankEvents.push(e) })
    prepared.done?.()
    set(finishChecking(entry.state, { cancelled: entry.cancelled, blankEvents, now: new Date().toISOString() }))
  })()

  return entry.state
}

/** Stops the project's run. False when nothing is running. */
export function cancelRun(root: string): boolean {
  const entry = runs.get(root)
  if (!entry || !isRunning(entry.state)) return false
  entry.cancelled = true
  killGroup(entry.child)
  return true
}
