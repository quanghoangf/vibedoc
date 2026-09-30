// Self-check for task review history. Run: node src/lib/review.check.mts
import assert from 'node:assert/strict'
import { appendReviewEntry, latestReview, reviewHistory } from './review.ts'

const task = '# T001: First\n**Status:** 👀 Review\n\n## Goal\nDo it.\n'

// No section yet → none
assert.equal(latestReview(task), null)
assert.deepEqual(reviewHistory(task), [])

// First entry creates the section at the end; head meta block untouched
const one = appendReviewEntry(task, 'changes requested', 'scroll broken\nwith 10+ tasks', '2026-10-01T11:00:00Z')
assert.ok(one.startsWith(task.trimEnd()))
assert.ok(one.endsWith('## Review\n### 2026-10-01T11:00:00Z — changes requested\nscroll broken\nwith 10+ tasks\n'))
assert.deepEqual(latestReview(one), { at: '2026-10-01T11:00:00Z', outcome: 'changes requested', note: 'scroll broken\nwith 10+ tasks' })

// Second entry appends to the same section, even when another section follows it
const withAfter = `${one}\n## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] A\n`
const two = appendReviewEntry(withAfter, 'approved', '', '2026-10-02T09:30:00Z')
assert.equal(two.match(/^## Review$/gm)?.length, 1, 'one section')
assert.ok(two.indexOf('— approved') < two.indexOf('## Manual tests'), 'entry stays inside the Review section')
assert.ok(two.includes('## Manual tests\n_2026-10-01 — ai_\n### Steps\n- [ ] A'), 'following section untouched')
assert.deepEqual(reviewHistory(two).map((e) => e.outcome), ['changes requested', 'approved'])
assert.deepEqual(latestReview(two), { at: '2026-10-02T09:30:00Z', outcome: 'approved', note: '' })

// Send back needs a note; approve doesn't
assert.throws(() => appendReviewEntry(task, 'changes requested', '   ', '2026-10-01T11:00:00Z'), /note is required/)
assert.doesNotThrow(() => appendReviewEntry(task, 'approved', '', '2026-10-01T11:00:00Z'))

// A note line that looks like a heading can't end the section
const tricky = appendReviewEntry(task, 'changes requested', '## not a heading', '2026-10-01T11:00:00Z')
assert.equal(latestReview(tricky)?.note, '\\## not a heading')

// A quoted example inside a code fence (like T062's own spec) is not the section
const quoted = '# T1: x\n\n## Notes\n```md\n## Review\n### 2026-10-01T11:00:00Z — changes requested\nx\n```\n'
assert.equal(latestReview(quoted), null)

console.log('review: ok')
