/**
 * VibeDoc's Playwright reporter (R061): one `@@vibedoc {json}` stdout line at the start (test count), per top-level
 * `test.step` begin / end, and at the end, which the server's runner (src/lib/test-runner.ts) turns into live SSE events.
 * Passed by path (`--reporter=list,<this file>`), so the target repo installs nothing. Works for any spec: the
 * vibedoc fixture's `step()` is a `test.step` too. Standalone on purpose (type-only imports, plus node's path): Playwright loads it
 * from outside the target repo. The prefix must match RUN_LINE_PREFIX in src/lib/test-run-events.ts.
 */

import path from 'path'
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter'

const PREFIX = '@@vibedoc '
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')

// R064: same lookup as src/lib/task-map.ts (copied: this file loads standalone). A suite maps spec → task.
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
function taskMap(): Record<string, string> {
  try {
    const raw = JSON.parse(process.env.VIBEDOC_TASK_MAP || '{}')
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => typeof t === 'string').map(([f, t]) => [norm(f), t as string]))
  } catch {
    return {}
  }
}

export default class VibedocReporter implements Reporter {
  private index = new Map<TestStep, number>()
  /** Top-level steps so far, per test (a suite runs many tests) */
  private count = new Map<string, number>()
  private map = taskMap()

  printsToStdio() {
    return false // the list reporter next to it owns the console
  }

  private emit(event: object) {
    process.stdout.write(`${PREFIX}${JSON.stringify(event)}\n`)
  }

  private top(step: TestStep) {
    return step.category === 'test.step' && !step.parent
  }

  /** Spec path relative to the cwd (what VIBEDOC_TASK_MAP is keyed by) and its task. */
  private where(test: TestCase) {
    const file = norm(path.relative(process.cwd(), test.location.file))
    return { file, taskId: this.map[file] ?? (process.env.VIBEDOC_TASK_ID || null) }
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.emit({ type: 'begin', tests: suite.allTests().length })
  }

  onTestBegin(test: TestCase) {
    this.emit({ type: 'test-begin', ...this.where(test), title: test.title })
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.emit({ type: 'test-end', ...this.where(test), title: test.title, status: result.status })
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep) {
    if (!this.top(step)) return
    const n = (this.count.get(test.id) ?? 0) + 1
    this.count.set(test.id, n)
    this.index.set(step, n)
    this.emit({ type: 'step-begin', index: n, name: step.title, ...this.where(test) })
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    const index = this.index.get(step)
    if (index === undefined) return
    // The headline, then Playwright's Expected / Received lines when it printed them
    const lines = step.error?.message ? plain(step.error.message).split('\n').map(l => l.trim()).filter(Boolean) : []
    const error = lines.length ? [lines[0], ...lines.filter(l => /^(Expected|Received):/.test(l))].join('\n') : null
    this.emit({ type: 'step-end', index, name: step.title, status: step.error ? 'failed' : 'passed', error, ...this.where(test) })
  }

  onEnd(result: FullResult) {
    this.emit({ type: 'end', status: result.status })
  }
}
