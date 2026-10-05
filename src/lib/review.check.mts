// Self-check for task review history. Run: node src/lib/review.check.mts
import assert from 'node:assert/strict'
import { REVIEWABLE, appendReviewEntry, formatReviewBody, latestReview, parseReviewMarks, reviewHistory } from './review.ts'

const task = '# T001: First\n**Status:** 👀 Review\n\n## Goal\nDo it.\n'

// No section yet → none
assert.equal(latestReview(task), null)
assert.deepEqual(reviewHistory(task), [])

// First entry creates the section at the end; head meta block untouched
const one = appendReviewEntry(task, 'changes requested', 'scroll broken\nwith 10+ tasks', '2026-10-01T11:00:00Z')
assert.ok(one.startsWith(task.trimEnd()))
assert.ok(one.endsWith('## Review\n### 2026-10-01T11:00:00Z — changes requested\nscroll broken\nwith 10+ tasks\n'))
assert.deepEqual(latestReview(one), { at: '2026-10-01T11:00:00Z', outcome: 'changes requested', note: 'scroll broken\nwith 10+ tasks', marks: [] })

// Second entry appends to the same section, even when another section follows it
const withAfter = `${one}\n## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] A\n`
const two = appendReviewEntry(withAfter, 'approved', '', '2026-10-02T09:30:00Z')
assert.equal(two.match(/^## Review$/gm)?.length, 1, 'one section')
assert.ok(two.indexOf('— approved') < two.indexOf('## Manual tests'), 'entry stays inside the Review section')
assert.ok(two.includes('## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] A'), 'following section untouched')
assert.deepEqual(reviewHistory(two).map((e) => e.outcome), ['changes requested', 'approved'])
assert.deepEqual(latestReview(two), { at: '2026-10-02T09:30:00Z', outcome: 'approved', note: '', marks: [] })

// Approve only from review; send back also reopens a done task (a failed run on finished work)
assert.deepEqual(REVIEWABLE.approved, ['review'])
assert.deepEqual(REVIEWABLE['changes requested'], ['review', 'done'])

// Send back needs a note; approve doesn't
assert.throws(() => appendReviewEntry(task, 'changes requested', '   ', '2026-10-01T11:00:00Z'), /note is required/)
assert.doesNotThrow(() => appendReviewEntry(task, 'approved', '', '2026-10-01T11:00:00Z'))

// A note line that looks like a heading can't end the section
const tricky = appendReviewEntry(task, 'changes requested', '## not a heading', '2026-10-01T11:00:00Z')
assert.equal(latestReview(tricky)?.note, '\\## not a heading')

// A quoted example inside a code fence (like T062's own spec) is not the section
const quoted = '# T1: x\n\n## Notes\n```md\n## Review\n### 2026-10-01T11:00:00Z — changes requested\nx\n```\n'
assert.equal(latestReview(quoted), null)

// R062: marks round trip through the entry body
{
  const marks = [
    { item: 2, step: 'Click Save → toast shows', kind: 'failed' as const, comment: 'Timeout waiting for toast', screenshot: '03-click-save.png' },
    { item: 4, step: 'Say "hi" | pipes', kind: 'doubt' as const, comment: 'the old row\nis still visible' },
    { item: 0, step: 'No comment', kind: 'doubt' as const },
  ]
  const body = formatReviewBody('Also check mobile.', '20261012T094500Z', marks)
  assert.equal(body, [
    'Run 20261012T094500Z',
    '- ❌ Step 3 "Click Save → toast shows" — failed: Timeout waiting for toast · screenshot 03-click-save.png',
    '- ⚠️ Step 5 "Say "hi" | pipes" — doubt: the old row is still visible',
    '- ⚠️ Step 1 "No comment" — doubt',
    '',
    'Also check mobile.',
  ].join('\n'))
  const sent = latestReview(appendReviewEntry(task, 'changes requested', body, '2026-10-12T10:00:00Z'))!
  assert.equal(sent.runId, '20261012T094500Z')
  assert.deepEqual(sent.marks, [marks[0], { ...marks[1], comment: 'the old row is still visible' }, marks[2]])
  // Marks only, no free text
  assert.equal(formatReviewBody('', null, [marks[2]]), '- ⚠️ Step 1 "No comment" — doubt')
  // Approve: run + "All N steps reviewed"
  assert.equal(formatReviewBody('', '20261012T094500Z', [], 5), 'Run 20261012T094500Z\nAll 5 steps reviewed')
  // Old entries (plain note) parse with no marks
  assert.deepEqual(parseReviewMarks('The plan card does not scroll.'), { marks: [] })
}

console.log('review: ok')
