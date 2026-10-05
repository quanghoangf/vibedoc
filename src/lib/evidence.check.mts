import assert from 'node:assert/strict'
import { formatEvidence, matchItems, ticksForRun } from './evidence.ts'

const item = (index: number, text: string, auto: boolean, checked = false, group: 'steps' | 'regression' = 'steps') => ({ index, text, auto, checked, group })
const step = (index: number, name: string, status: 'passed' | 'failed' = 'passed', error: string | null = null) =>
  ({ index, name, status, screenshot: `0${index}-s.png`, error })
const run = (runId: string, steps: ReturnType<typeof step>[], commit: string | null = 'abcdef1234') => ({
  runId, taskId: 'T1', project: 'p', startedAt: '2026-10-04T07:43:14.000Z', endedAt: '2026-10-04T07:43:15.200Z',
  status: steps.some(s => s.status === 'failed') ? 'failed' as const : 'passed' as const, commit, video: 'video.webm', steps,
})

const items = [
  item(0, 'Open / → board loads', true),
  item(1, 'Click X → reads Y', true),
  item(2, 'Looks right', false, true),
  item(3, 'Drag still works', false, false, 'regression'),
  item(4, 'Gone step → nope', true, false, 'regression'),
]
const newer = run('20261004T080000Z', [step(1, '  Open /   → board loads '), step(2, 'Click X → reads Y', 'failed', 'Expected: "Y"\nReceived: "Z"'), step(3, 'Extra one')])
const older = run('20261004T070000Z', [step(1, 'Open / → board loads'), step(2, 'Click X → reads Y')], null)

// Matching: whitespace-insensitive, missing and extra, manual keeps its tick
const m = matchItems(items, newer)
assert.deepEqual(m.rows.map(r => r.result), ['passed', 'failed', 'manual', 'manual', 'missing'])
assert.deepEqual(m.extra.map(s => s.name), ['Extra one'])
assert.deepEqual(matchItems(items, null).rows.map(r => r.result), ['missing', 'missing', 'manual', 'manual', 'missing'])

const doc = formatEvidence({ taskId: 'T1', title: 'One', items, spec: 'e2e/vibedoc/T1.spec.ts', runs: [newer, older] })
assert.ok(doc.startsWith('# T1 — One: evidence\n'))
assert.match(doc, /\*\*❌ failed\*\* · 2\/3 steps · 2026-10-04 07:43:14 UTC · 1\.2s · commit `abcdef1` · spec `e2e\/vibedoc\/T1\.spec\.ts`/)
assert.match(doc, /\[▶ Video of this run\]\(20261004T080000Z\/video\.webm\)/)
assert.match(doc, /- ✅ Open \/ → board loads\n {2}!\[Open \/ → board loads\]\(20261004T080000Z\/01-s\.png\)/)
assert.match(doc, /- ❌ Click X → reads Y\n {2}```\n {2}Expected: "Y"\n {2}Received: "Z"\n {2}```\n {2}!\[/)
assert.match(doc, /- ☑ Looks right — _manual, ticked_/)
assert.match(doc, /### Regression risk\n- ☐ Drag still works — _manual, not ticked yet_\n- ⚠️ Gone step → nope — _no step in this run_/)
assert.match(doc, /### Steps not in the checklist\n- ✅ Extra one/)
// History newest first, the shown run marked, missing commit as —
const hist = doc.slice(doc.indexOf('## History'))
assert.ok(hist.indexOf('20261004T080000Z') < hist.indexOf('20261004T070000Z'))
assert.match(hist, /UTC · \*\*shown\*\* \| ❌ failed \| 2\/3 \| `abcdef1`/)
assert.match(hist, /\| ✅ passed \| 2\/2 \| — \|/)

// Picking an older run details it; a custom src maps links
const old = formatEvidence({ taskId: 'T1', title: 'One', items, spec: null, runs: [newer, older], runId: older.runId, src: (r, f) => `/api/x/${r}/${f}` })
assert.match(old, /\*\*✅ passed\*\* · 2\/2 steps/)
assert.match(old, /!\[Click X → reads Y\]\(\/api\/x\/20261004T070000Z\/02-s\.png\)/)
assert.ok(!old.includes('Steps not in the checklist'))
assert.match(old, /2026-10-04 07:43:14 UTC · \*\*shown\*\* \| ✅ passed/)

// No runs: one line, items still listed, no history
const none = formatEvidence({ taskId: 'T1', title: 'One', items, spec: 'a.spec.ts', runs: [] })
assert.match(none, /_No run yet\. Run `a\.spec\.ts` to record evidence\._/)
assert.match(none, /- ⚠️ Open \/ → board loads — _no run yet_/)
assert.ok(!none.includes('## History'))

// No checklist (no task file): run steps are the doc
const bare = formatEvidence({ taskId: 'no-task', title: 'no-task', items: [], spec: null, runs: [older] })
assert.match(bare, /## Steps\n- ✅ Open \/ → board loads/)
assert.ok(!bare.includes('## Checklist'))
console.log('ok evidence')

// R061: a Run's write-back: passed 🤖 ticked, failed 🤖 unticked, manual and unmatched untouched
{
  const its = [item(0, 'A → a', true), item(1, 'B → b', true, true), item(2, 'C → c', true, true), item(3, 'Manual', false), item(4, 'No step', true)]
  assert.deepEqual(ticksForRun(its, [{ name: 'A → a', status: 'passed' }, { name: ' B  → b', status: 'passed' }, { name: 'C → c', status: 'failed' }, { name: 'Manual', status: 'passed' }]), { tick: [0], untick: [2] })
  assert.deepEqual(ticksForRun(its, []), { tick: [], untick: [] })
  console.log('ok ticksForRun')
}
