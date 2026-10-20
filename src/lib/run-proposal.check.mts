// Self-check for run-proposal. Run: node src/lib/run-proposal.check.mts
import assert from 'node:assert/strict'
import { epicOf, formatProposal, formatWorkers, freeBranch, routeRun, runRefusals, validateRunProposal, type RunContext, type WorkerInfo } from './run-proposal.ts'

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

// T560: a task target. R2 lists T1, T2; T9 is loose
const task = (id: string) => ({ kind: 'task' as const, id })
const tctx = (o: Partial<RunContext> = {}) => ctx({
  roadmap: [{ id: 'R1', parent: null, status: 'in-progress', tasks: ['T1'] }, { id: 'R2', parent: 'R1', status: 'in-progress', tasks: ['T1', 'T2'] }],
  tasks: [{ id: 'T1', status: 'todo', owner: null }, { id: 'T2', status: 'in-progress', owner: 'ai:worker-c-1' }, { id: 'T3', status: 'done', owner: null }, { id: 'T9', status: 'todo', owner: null }],
  ...o,
})
assert.equal(epicOf(task('T1'), tctx()), 'R2', 'the epic, never the horizon')
assert.equal(epicOf(task('T9'), tctx()), null)
// no worker → a new worktree on vibedoc/T1, loose or not
const tNew = routeRun(task('T1'), tctx())
assert.deepEqual([tNew.mode, tNew.branch], ['new', 'vibedoc/T1'])
assert.deepEqual(validateRunProposal(tNew, tctx()), [])
assert.equal(routeRun(task('T9'), tctx()).branch, 'vibedoc/T9')
// its epic has an idle worker → that worker (it claims T1 next)
const tIdle = tctx({ workers: [worker()] })
const tExisting = routeRun(task('T1'), tIdle)
assert.deepEqual([tExisting.mode, tExisting.workerId, tExisting.branch], ['existing', 'c-1', 'vibedoc/R2'])
assert.deepEqual(validateRunProposal(tExisting, tIdle), [])
assert.match(validateRunProposal(routeRun(task('T1'), tIdle, { mode: 'new' }), tIdle)[0], /R2 already has worker c-1/)
// a loose task's own worker
const looseW = tctx({ workers: [worker({ id: 'c-7', target: task('T9'), branch: 'vibedoc/T9' })] })
assert.equal(routeRun(task('T9'), looseW).workerId, 'c-7')
assert.equal(routeRun(task('T9'), tIdle).mode, 'new', "another epic's worker is not a loose task's")
// refusals: unknown, finished, someone else's in-progress (the worker's own is fine)
assert.match(validateRunProposal(routeRun(task('T8'), tctx()), tctx())[0], /Task T8 not found/)
assert.match(validateRunProposal(routeRun(task('T3'), tctx()), tctx())[0], /T3 is done/)
assert.match(validateRunProposal(routeRun(task('T2'), tctx(), { mode: 'new' }), tctx())[0], /T2 is in progress \(ai:worker-c-1\)/)
assert.deepEqual(validateRunProposal(routeRun(task('T2'), tIdle), tIdle), [])
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

// base = the main checkout's branch when known; HEAD only when detached
assert.equal(routeRun(epic('R3'), ctx({ currentBranch: 'main' })).base, 'main')
assert.equal(routeRun(epic('R3'), ctx({ currentBranch: 'main' }), { base: 'dev' }).base, 'dev')
// unfinished dependencies are named (done and review aren't), only for a new task worktree
const deps = ctx({ tasks: [
  { id: 'T1', status: 'todo', owner: null, dependsOn: ['T2', 'T3', 'T4'] },
  { id: 'T2', status: 'in-progress', owner: 'human' }, { id: 'T3', status: 'done', owner: null }, { id: 'T4', status: 'review', owner: null },
] })
assert.deepEqual(routeRun(task('T1'), deps).waitingOn, [{ id: 'T2', status: 'in-progress' }])
assert.equal(routeRun(task('T2'), deps).waitingOn, undefined)
// refusals as data: code + vars for the UI, the same text as validateRunProposal
const busyRef = runRefusals(routeRun(epic('R2'), ctx({ workers: [worker({ running: true, currentTask: 'T5' })] })), ctx({ workers: [worker({ running: true, currentTask: 'T5' })] }))
assert.deepEqual([busyRef[0].code, busyRef[0].workerId, busyRef[0].vars.task], ['worker-running', 'c-1', 'T5'])
const dupRef = runRefusals(routeRun(epic('R2'), idle, { mode: 'new' }), idle)
assert.deepEqual([dupRef[0].code, dupRef[0].workerId], ['has-worker', 'c-1'])
assert.equal(runRefusals(routeRun(epic('R3'), busy), busy)[0].code, 'limit')
assert.deepEqual(runRefusals(routeRun(task('T2'), deps), deps).map(r => [r.code, r.vars.owner]), [['in-progress', 'human']])

console.log('run-proposal: ok')
