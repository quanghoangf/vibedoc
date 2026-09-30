// Self-check for manual test reports. Run: node src/lib/manual-tests.check.mts
import assert from 'node:assert/strict'
import { normalizeReport, parseManualTests, setManualTests } from './manual-tests.ts'

const task = '# T001: First\n**Status:** 🔨 In Progress\n**Depends on:** —\n\n## Goal\nDo it.\n'

// New section: appended at the end, head meta block untouched
const one = setManualTests(task, '- [ ] Open / → board loads\n- [ ] Drag a card → it moves', 'ai', '2026-10-01')
assert.ok(one.startsWith(task.trimEnd()), 'meta block and body unchanged')
assert.ok(one.endsWith('## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] Open / → board loads\n- [ ] Drag a card → it moves\n'))
assert.deepEqual(parseManualTests(one), {
  total: 2, done: 0,
  items: [
    { text: 'Open / → board loads', checked: false, group: 'steps', index: 0 },
    { text: 'Drag a card → it moves', checked: false, group: 'steps', index: 1 },
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

console.log('manual-tests: ok')
