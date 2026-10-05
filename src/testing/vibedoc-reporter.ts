/**
 * VibeDoc's Playwright reporter (R061): one `@@vibedoc {json}` stdout line at the start (test count), per top-level
 * `test.step` begin / end, and at the end, which the server's runner (src/lib/test-runner.ts) turns into live SSE events.
 * Passed by path (`--reporter=list,<this file>`), so the target repo installs nothing. Works for any spec: the
 * vibedoc fixture's `step()` is a `test.step` too. Standalone on purpose (type-only imports): Playwright loads it
 * from outside the target repo. The prefix must match RUN_LINE_PREFIX in src/lib/test-run-events.ts.
 */

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter'

const PREFIX = '@@vibedoc '
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')

export default class VibedocReporter implements Reporter {
  private index = new Map<TestStep, number>()
  private count = 0

  printsToStdio() {
    return false // the list reporter next to it owns the console
  }

  private emit(event: object) {
    process.stdout.write(`${PREFIX}${JSON.stringify(event)}\n`)
  }

  private top(step: TestStep) {
    return step.category === 'test.step' && !step.parent
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.emit({ type: 'begin', tests: suite.allTests().length })
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep) {
    if (!this.top(step)) return
    this.index.set(step, ++this.count)
    this.emit({ type: 'step-begin', index: this.count, name: step.title })
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep) {
    const index = this.index.get(step)
    if (index === undefined) return
    const error = step.error?.message ? plain(step.error.message).split('\n').find(l => l.trim()) ?? null : null
    this.emit({ type: 'step-end', index, name: step.title, status: step.error ? 'failed' : 'passed', error })
  }

  onEnd(result: FullResult) {
    this.emit({ type: 'end', status: result.status })
  }
}
