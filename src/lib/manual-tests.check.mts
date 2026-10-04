// Self-check for manual test reports. Run: node src/lib/manual-tests.check.mts
import assert from 'node:assert/strict'
import { normalizeReport, parseManualTests, setManualTests, setManualTestsMeta, toggleManualTest } from './manual-tests.ts'

const task = '# T001: First\n**Status:** 🔨 In Progress\n**Depends on:** —\n\n## Goal\nDo it.\n'

// New section: appended at the end, head meta block untouched
const one = setManualTests(task, '- [ ] Open / → board loads\n- [ ] Drag a card → it moves', 'ai', '2026-10-01')
assert.ok(one.startsWith(task.trimEnd()), 'meta block and body unchanged')
assert.ok(one.endsWith('## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] Open / → board loads\n- [ ] Drag a card → it moves\n'))
assert.deepEqual(parseManualTests(one), {
  total: 2, done: 0, auto: 0, date: '2026-10-01', spec: null, autoRun: null,
  items: [
    { text: 'Open / → board loads', checked: false, group: 'steps', index: 0, auto: false },
    { text: 'Drag a card → it moves', checked: false, group: 'steps', index: 1, auto: false },
  ],
})

// Replacing: a second report replaces the first, even with a section after it; nothing else moves
const withAfter = `${one}\n## Blocked because\nIt broke.\n`
const two = setManualTests(withAfter, '### Steps\n- [x] A\n### Regression risk\n- [ ] B\n- [ ] C', 'human', '2026-10-02')
assert.equal(two.match(/## Manual tests/g)?.length, 1, 'one section')
assert.ok(!two.includes('board loads'), 'old items gone')
assert.ok(two.includes('## Blocked because\nIt broke.'), 'following section kept')
assert.ok(two.indexOf('## Blocked because') < two.indexOf('## Manual tests'), 'new report goes last')
assert.match(two, /_2026-10-02 — human_/)

// Counting across both groups
const counted = parseManualTests(two)
assert.equal(counted?.total, 3)
assert.equal(counted?.done, 1)
assert.deepEqual(counted?.items.map((i) => i.group), ['steps', 'regression', 'regression'])
assert.deepEqual(counted?.items.map((i) => i.index), [0, 1, 2])

// Plain-line normalization: text lines and plain bullets become unticked items under ### Steps
assert.equal(normalizeReport('Open /board\n\n* drag a card\n- [X] already checked'), '### Steps\n- [ ] Open /board\n- [ ] drag a card\n- [x] already checked')
assert.equal(normalizeReport('## Manual tests\n### Regression risk\n- old thing'), '### Regression risk\n- [ ] old thing')
assert.throws(() => setManualTests(task, '  \n\n', 'ai', '2026-10-01'), /empty/)

// Existing tasks: no section → null; a heading with no items → null; a checkbox in the body doesn't count
assert.equal(parseManualTests(task), null)
assert.equal(parseManualTests('# T1: x\n\n## Acceptance criteria\n- [ ] body item\n'), null)
assert.equal(parseManualTests('# T1: x\n\n## Manual tests\n_2026 — ai_\n'), null)
// An example section inside a code fence (like T060's own spec) is not a report, and a real one after it still is
const quoted = '# T1: x\n\n## Notes\n```md\n## Manual tests\n- [ ] example\n```\n'
assert.equal(parseManualTests(quoted), null)
const realAfter = setManualTests(quoted, '- [ ] real', 'ai', '2026-10-01')
assert.ok(realAfter.includes('```md\n## Manual tests\n- [ ] example\n```'), 'quoted example kept')
assert.deepEqual(parseManualTests(realAfter)?.items.map((i) => i.text), ['real'])

// toggleManualTest: by index across both groups; only inside the section
const body = '# T1: x\n**Status:** ✅ Done\n\n## Acceptance criteria\n- [ ] criterion stays\n'
const both = setManualTests(body, '### Steps\n- [ ] s0\n- [ ] s1\n### Regression risk\n- [ ] r2', 'ai', '2026-10-01')
const t2 = toggleManualTest(both, 2, true)
assert.match(t2, /- \[x\] r2/)
assert.match(t2, /- \[ \] criterion stays/, 'acceptance criteria untouched')
assert.equal(parseManualTests(t2)?.done, 1)
const t0 = toggleManualTest(t2, 0, true)
assert.deepEqual(parseManualTests(t0)?.items.map((i) => i.checked), [true, false, true])
assert.deepEqual(parseManualTests(toggleManualTest(t0, 2, false))?.items.map((i) => i.checked), [true, false, false])
assert.equal(toggleManualTest(t0, 0, true), t0, 'ticking a ticked item changes nothing')
assert.ok(toggleManualTest(t0, 0, true).includes('**Status:** ✅ Done'), 'status untouched')
assert.throws(() => toggleManualTest(both, 3, true), RangeError)
assert.throws(() => toggleManualTest(body, 0, true), RangeError)

// R058: 🤖 items + spec / last run in the header line
const autoReport = '### Steps\n- [ ] 🤖 Open / → board loads\n- [ ] Drag a card → it moves\n### Regression risk\n- [ ] 🤖Search still filters'
const withSpec = setManualTests(body, autoReport, 'ai', '2026-10-04', { spec: 'e2e/vibedoc/T145-foo.spec.ts' })
assert.match(withSpec, /\n_2026-10-04 — ai · Spec: `e2e\/vibedoc\/T145-foo\.spec\.ts`_\n### Steps\n- \[ \] 🤖 Open/)
const parsedAuto = parseManualTests(withSpec)
assert.equal(parsedAuto?.auto, 2)
assert.equal(parsedAuto?.total, 3)
assert.equal(parsedAuto?.spec, 'e2e/vibedoc/T145-foo.spec.ts')
assert.equal(parsedAuto?.autoRun, null)
assert.deepEqual(parsedAuto?.items.map((i) => [i.text, i.auto, i.index]), [
  ['Open / → board loads', true, 0], ['Drag a card → it moves', false, 1], ['Search still filters', true, 2],
])
// Header with spec and run in one go
const withRun = setManualTests(body, autoReport, 'ai', '2026-10-04', { spec: 'e2e/a.spec.ts', autoRun: { result: 'failed', date: '2026-10-04' } })
assert.match(withRun, /_2026-10-04 — ai · Spec: `e2e\/a\.spec\.ts` · Auto: failed 2026-10-04_/)
assert.deepEqual(parseManualTests(withRun)?.autoRun, { result: 'failed', date: '2026-10-04' })
// Header-only update: ticks and items stay, spec kept, run replaced
const ticked = toggleManualTest(withSpec, 1, true)
const run = setManualTestsMeta(ticked, { autoRun: { result: 'passed', date: '2026-10-05' } }, 'ai', '2026-10-05')
assert.equal(run.replace(/\n_.*_\n### Steps/, ''), ticked.replace(/\n_.*_\n### Steps/, ''), 'only the header line changed')
assert.match(run, /_2026-10-04 — ai · Spec: `e2e\/vibedoc\/T145-foo\.spec\.ts` · Auto: passed 2026-10-05_/)
const rerun = parseManualTests(run)
assert.deepEqual(rerun?.autoRun, { result: 'passed', date: '2026-10-05' })
assert.equal(rerun?.done, 1)
assert.deepEqual(parseManualTests(setManualTestsMeta(run, { spec: 'e2e/b.spec.ts' }, 'ai', '2026-10-05'))?.autoRun, rerun?.autoRun, 'new spec keeps the run')
assert.equal(parseManualTests(setManualTestsMeta(run, { spec: null, autoRun: null }, 'ai', '2026-10-05'))?.spec, null)
assert.throws(() => setManualTestsMeta(body, { autoRun: { result: 'passed', date: '2026-10-05' } }, 'ai', '2026-10-05'), RangeError)
assert.throws(() => setManualTests(body, '- [ ] x', 'ai', '2026-10-04', { spec: '../outside.spec.ts' }), /relative/)
assert.throws(() => setManualTests(body, '- [ ] x', 'ai', '2026-10-04', { spec: '/abs.spec.ts' }), /relative/)
// Hand-written section without a stamp: a header-only update writes a real stamp that parses back
const hand = setManualTestsMeta('# T1: x\n\n## Manual tests\n- [ ] hand written\n', { spec: 'e2e/a.spec.ts', autoRun: { result: 'passed', date: '2026-10-04' } }, 'ai', '2026-10-04')
assert.match(hand, /## Manual tests\n_2026-10-04 — ai · Spec: `e2e\/a\.spec\.ts` · Auto: passed 2026-10-04_\n- \[ \] hand written/)
const handParsed = parseManualTests(hand)
assert.equal(handParsed?.spec, 'e2e/a.spec.ts')
assert.deepEqual(handParsed?.autoRun, { result: 'passed', date: '2026-10-04' })
assert.equal(handParsed?.total, 1)
// A new report replaces spec and run too
assert.equal(parseManualTests(setManualTests(run, '- [ ] plain', 'ai', '2026-10-06'))?.spec, null)
// Index stability: ticking 🤖 items by index works and keeps the prefix
const tickAuto = toggleManualTest(withSpec, 2, true)
assert.match(tickAuto, /- \[x\] 🤖Search still filters/)
assert.deepEqual(parseManualTests(tickAuto)?.items.map((i) => [i.checked, i.auto]), [[false, true], [false, false], [true, true]])

console.log('manual-tests: ok')
