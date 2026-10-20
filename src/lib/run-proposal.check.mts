// Self-check for run-proposal. Run: node src/lib/run-proposal.check.mts
import assert from 'node:assert/strict'
import { formatProposal, formatWorkers, freeBranch, routeRun, validateRunProposal, type RunContext, type WorkerInfo } from './run-proposal.ts'

const epic = (id: string) => ({ kind: 'epic' as const, id })
const worker = (o: Partial<WorkerInfo> = {}): WorkerInfo => ({
  id: 'c-1', target: epic('R2'), branch: 'vibedoc/R2', base: 'HEAD', dir: '/w', phase: 'ended', running: false,
  currentTask: null, lastReply: 'Done T1', ahead: 2, updatedAt: '2026-10-20T00:00:00Z', ...o,
})
const ctx = (o: Partial<RunContext> = {}): RunContext => ({
  roadmap: [
    { id: 'R1', parent: null, status: 'in-progress' },
    { id: 'R2', parent: 'R1', status: 'in-progress' },
    { id: 'R3', parent: 'R1', status: 'planned' },
    { id: 'R4', parent: 'R1', status: 'done' },
  ],
  workers: [], branches: ['main'], maxRunning: 2, allowedTools: ['Read'], denied: ['Bash(git push*)'], ...o,
})
const errs = (target: string, c: RunContext, want = {}) => validateRunProposal(routeRun(epic(target), c, want), c)

// no worker → a new worktree on vibedoc/<epic> from HEAD, valid as proposed (S8)
const fresh = routeRun(epic('R3'), ctx())
assert.deepEqual(fresh, { target: epic('R3'), mode: 'new', branch: 'vibedoc/R3', base: 'HEAD', allowedTools: ['Read'], denied: ['Bash(git push*)'] })
assert.deepEqual(validateRunProposal(fresh, ctx()), [])
// T567: the settings' budget per task rides on the proposal, both modes
const budget = { maxTurns: 60, timeoutMin: 30 }
assert.deepEqual(routeRun(epic('R3'), ctx({ budget })).budget, budget)
assert.deepEqual(routeRun(epic('R2'), ctx({ budget, workers: [worker()] })).budget, budget)
assert.match(formatProposal(routeRun(epic('R3'), ctx({ budget }))), /Budget: 60 turns · 30 min per task\./)
// a removed worker left its branch: the default moves on, so the card is still acceptable as is
assert.equal(freeBranch('R3', ['vibedoc/R3', 'vibedoc/R3-2']), 'vibedoc/R3-3')
assert.equal(routeRun(epic('R3'), ctx({ branches: ['vibedoc/R3'] })).branch, 'vibedoc/R3-2')

// the epic has an idle worker → send it there (S7)
const idle = ctx({ workers: [worker()] })
const toWorker = routeRun(epic('R2'), idle)
assert.equal(toWorker.mode, 'existing')
assert.equal(toWorker.workerId, 'c-1')
assert.equal(toWorker.branch, 'vibedoc/R2')
assert.equal(toWorker.running, false)
assert.deepEqual(validateRunProposal(toWorker, idle), [])
// the newest worker of the epic, a running one first
assert.equal(routeRun(epic('R2'), ctx({ workers: [worker(), worker({ id: 'c-2', updatedAt: '2026-10-21T00:00:00Z' })] })).workerId, 'c-2')
assert.equal(routeRun(epic('R2'), ctx({ workers: [worker({ running: true }), worker({ id: 'c-2', updatedAt: '2026-10-21T00:00:00Z' })] })).workerId, 'c-1')

// refusals
assert.match(errs('R9', ctx())[0], /Epic R9 not found/)
assert.match(errs('R1', ctx())[0], /horizon/)
assert.match(errs('R4', ctx())[0], /R4 is done/)
assert.match(validateRunProposal(routeRun({ kind: 'task', id: 'T1' }, ctx()), ctx())[0], /Only an epic/)
// new while the epic has a worker: names it
const dup = errs('R2', idle, { mode: 'new' })
assert.equal(dup.length, 1)
assert.match(dup[0], /R2 already has worker c-1 on vibedoc\/R2 \(ended\): send the run to it \(mode "existing", workerId "c-1"\)/)
// branch taken (explicit)
assert.deepEqual(errs('R3', ctx(), { mode: 'new', branch: 'main' }), ['Branch main already exists'])
assert.deepEqual(validateRunProposal({ ...fresh, branch: ' ', base: '' }, ctx()), ['A branch name is required', 'A base is required'])
// existing with an unknown worker / a worker of another epic / a running one
assert.match(errs('R2', idle, { mode: 'existing', workerId: 'c-9' })[0], /No worker c-9/)
assert.match(errs('R3', idle, { workerId: 'c-1' })[0], /works on R2, not R3/)
assert.match(errs('R2', ctx({ workers: [worker({ running: true, currentTask: 'T5' })] }))[0], /already running on R2 \(T5\)/)
assert.equal(routeRun(epic('R2'), ctx({ workers: [worker({ running: true })] })).running, true)
// over maxRunning (running workers only count)
const busy = ctx({ maxRunning: 1, workers: [worker({ id: 'c-x', target: epic('R9'), running: true })] })
assert.match(errs('R3', busy)[0], /limit of 1 running workers/)
assert.match(errs('R2', ctx({ maxRunning: 1, workers: [worker(), worker({ id: 'c-x', target: epic('R9'), running: true })] }))[0], /limit of 1/)
assert.deepEqual(errs('R3', ctx({ maxRunning: 1, workers: [worker()] })), [])

// list_workers lines
const listed = formatWorkers([worker({ phase: 'running', currentTask: 'T5', port: 3100 })])
assert.match(listed, /c-1.*R2.*vibedoc\/R2.*running \(no live process\).*on T5.*2 commits ahead.*port 3100/)
assert.match(listed, /last: Done T1/)
assert.match(formatWorkers([]), /No workers/)

console.log('run-proposal: ok')
