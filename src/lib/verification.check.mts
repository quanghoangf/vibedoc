// Self-check for verification. Run: node src/lib/verification.check.mts
import assert from 'node:assert/strict'
import { blockingCount, formatFindingsNote, formatVerification, isOutdated, parseVerification, setVerification, validateFindings, type Verification } from './verification.ts'

const v: Verification = {
  at: '2026-10-06', by: 'ai:claude-code', sha: '3f2a91c', findings: [
    { severity: 'critical', criterion: 'AC2 "Unknown plan → 400"', message: 'route returns 500', file: 'src/app/api/checkout/route.ts:41' },
    { severity: 'minor', criterion: 'Scope "update the stale comment"', message: 'comment still says R060' },
  ],
}

// format matches the documented shape; parse round-trips
assert.equal(formatVerification(v), [
  '## Verification',
  '_2026-10-06 — ai:claude-code · at 3f2a91c_',
  '- [critical] AC2 "Unknown plan → 400" — route returns 500 · `src/app/api/checkout/route.ts:41`',
  '- [minor] Scope "update the stale comment" — comment still says R060',
].join('\n'))
assert.deepEqual(parseVerification(formatVerification(v)), v)
// no findings = verified, nothing found; the header stays
const clean: Verification = { at: '2026-10-07', by: 'ai:x', findings: [] }
assert.match(formatVerification(clean), /_2026-10-07 — ai:x_\nVerified: nothing found\.$/)
assert.deepEqual(parseVerification(formatVerification(clean)), clean)
// " — " inside a criterion can't split it
assert.equal(parseVerification(formatVerification({ ...clean, findings: [{ severity: 'major', criterion: 'a — b', message: 'm' }] }))?.findings[0].criterion, 'a - b')

// no section / fenced section → null
assert.equal(parseVerification('# T1: x\n## Goal\ny'), null)
assert.equal(parseVerification('# T1\n```\n## Verification\n_2026-01-01 — ai:x_\n```\n'), null)

// set: appended at the end when there's no Review
const task = '# T1: x\n**Status:** done\n\n## Goal\ny\n\n## Manual tests\n_2026-10-01 — ai_\n- [ ] a\n'
const once = setVerification(task, v)
assert.ok(once.startsWith(task.trimEnd() + '\n\n## Verification\n'))
assert.deepEqual(parseVerification(once), v)
// set again: replaced; everything else byte-for-byte the same
const twice = setVerification(once, clean)
assert.equal(twice, setVerification(task, clean))
assert.deepEqual(parseVerification(twice), clean)
// set: before an existing Review, which stays untouched
const reviewed = task + '\n## Review\n### 2026-10-02T09:30:00Z — approved\n'
const withV = setVerification(reviewed, v)
assert.ok(withV.includes('comment still says R060\n\n## Review\n### 2026-10-02T09:30:00Z — approved\n'))
assert.equal(setVerification(withV, clean).replace(/## Verification[\s\S]*?\n\n(?=## Review)/, ''), task + '\n## Review\n### 2026-10-02T09:30:00Z — approved\n')
// replacing a middle section keeps the next one and the blank line before it
assert.equal(setVerification(setVerification(withV, clean), v), withV)
// a fenced "## Review" is not the Review section
const fencedReview = task + '\n```\n## Review\n```\n'
assert.ok(setVerification(fencedReview, clean).endsWith('```\n\n## Verification\n_2026-10-07 — ai:x_\nVerified: nothing found.\n'))

// validateFindings
assert.deepEqual(validateFindings([{ severity: 'major', criterion: ' AC1\nx ', message: 'm', file: 'a.ts:1' }]),
  [{ severity: 'major', criterion: 'AC1 x', message: 'm', file: 'a.ts:1' }])
assert.deepEqual(validateFindings([]), [])
assert.match(validateFindings([{ severity: 'blocker', criterion: 'a', message: 'm' }]) as string, /critical, major, minor/)
assert.match(validateFindings([{ severity: 'minor', criterion: '', message: 'm' }]) as string, /criterion is required/)
assert.match(validateFindings([{ severity: 'minor', criterion: 'a' }]) as string, /message is required/)
assert.match(validateFindings('x') as string, /must be an array/)

// blockingCount
assert.equal(blockingCount(v), 1)
assert.equal(blockingCount(null), 0)

// formatFindingsNote: the picked findings, one line each in the section's format
assert.equal(formatFindingsNote([]), '')
assert.equal(formatFindingsNote(v.findings), [
  'Fix these 2 verification findings:',
  '- [critical] AC2 "Unknown plan → 400" — route returns 500 · `src/app/api/checkout/route.ts:41`',
  '- [minor] Scope "update the stale comment" — comment still says R060',
].join('\n'))
assert.match(formatFindingsNote([v.findings[1]]), /^Fix this verification finding:\n- \[minor\]/)

// isOutdated: a later commit naming the task → outdated; anything else → not
const log = [
  { sha: 'ccc3333', subject: 'fix(x): handle 400 (T186)' },
  { sha: 'bbb2222', subject: 'chore: other work (T1860)' },
  { sha: '3f2a91cdeadbeef', subject: 'feat(x): first try (T186)' },
]
assert.equal(isOutdated('3f2a91c', 'T186', log), true)
assert.equal(isOutdated('3f2a91c', 'T999', log), false)
assert.equal(isOutdated('ccc3333', 'T186', log), false)
assert.equal(isOutdated('bbb2222', 'T186', log), true)
assert.equal(isOutdated('bbb2222', 'T18', log), false) // T1860 / T186 are other tasks
assert.equal(isOutdated(undefined, 'T186', log), false)
assert.equal(isOutdated('0000000', 'T186', log), false)

console.log('verification ok')
