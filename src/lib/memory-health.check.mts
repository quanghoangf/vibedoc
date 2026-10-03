// Self-check for memory-health. Run: node src/lib/memory-health.check.mts
import assert from 'node:assert/strict'
import { duplicateScore, findContradictions, findDuplicates, formatHealthWarnings, splitSections, type DupEntry, type HealthFlag } from './memory-health.ts'
import { extractRefs } from './memory-graph.ts'
import { tokenize } from './recall.ts'

const refsOf = (t: string) => extractRefs(t).ids
const board = [
  { id: 'T001', status: 'done' }, { id: 'T002', status: 'in-progress' }, { id: 'T003', status: 'cancelled' },
  { id: 'T004', status: 'todo' }, { id: 'R010', status: 'done' }, { id: 'R011', status: 'in-progress' },
]
const memo = (s: { working?: string; next?: string; done?: string; extra?: string }) =>
  `# Project Memory\n\n## Current state\nAll good.\n\n## Just completed\n${s.done ?? '- (nothing)'}\n\n## Working on now\n${s.working ?? '(nothing active)'}\n\n## Up next\n${s.next ?? '1. (define next steps)'}\n\n## Handoff for next session\n${s.extra ?? 'Carry on.'}\n`
const check = (md: string, entries: { id: string; body: string; summary: string }[] = []) => findContradictions(md, entries, board, refsOf)
const msgs = (f: HealthFlag[]) => f.map(x => x.message)

// splitSections
assert.deepEqual(splitSections('intro\n## A\none\n## B two\nb\n').map(s => s.heading), ['', 'A', 'B two'])
assert.equal(splitSections('## A\nx\ny\n## B\n')[1].body, 'x\ny\n')
// a `##` inside a ``` fence is an example, not a section
assert.deepEqual(splitSections('## A\n```md\n## B\n```\n## C\n').map(s => s.heading), ['', 'A', 'C'])
assert.deepEqual(check('## Current state\n```md\n## Working on now\nT001 example\n```\n## Up next\n1. T002\n'), [])

// matching handoff → no flags, no block
const clean = check(memo({ working: 'T002 and R011', next: '1. T004', done: '- T001' }))
assert.deepEqual(clean, [])
assert.equal(formatHealthWarnings(clean), '')

// Working on names a done task; cancelled counts as closed; epics too
assert.deepEqual(msgs(check(memo({ working: 'T001, T003 and R010' }))), [
  'Handoff says R010 is in progress, but it is done',
  'Handoff says T001 is in progress, but it is done',
  'Handoff says T003 is in progress, but it is cancelled',
])
const w = check(memo({ working: 'T001' }))[0]
assert.deepEqual(w, { id: 'contradiction:working-on:T001', kind: 'contradiction', severity: 'warn', message: 'Handoff says T001 is in progress, but it is done', refs: ['T001'] })
assert.deepEqual(msgs(check(memo({ next: '1. R010' }))), ['Handoff says R010 is up next, but it is done'])

// Just completed names a task that isn't done (epics there are context, not flagged)
assert.deepEqual(msgs(check(memo({ done: '- T002 of R011' }))), ['Handoff says T002 is done, but it is in-progress'])
// other sections never produce contradictions
assert.deepEqual(check(memo({ extra: 'T001 shipped, T002 next' })), [])

// dangling refs: handoff + entries, info only; done tasks in entries are fine
const dang = check(memo({ extra: 'see T999' }), [{ id: 'E012', summary: 'About R999', body: 'T001 is done; T999 too' }])
assert.deepEqual(dang.map(f => [f.id, f.kind, f.severity, f.message]), [
  ['dangling-ref:E012:R999', 'dangling-ref', 'info', "E012 mentions R999, which doesn't exist"],
  ['dangling-ref:E012:T999', 'dangling-ref', 'info', "E012 mentions T999, which doesn't exist"],
  ['dangling-ref:handoff:T999', 'dangling-ref', 'info', "Handoff mentions T999, which doesn't exist"],
])
// E/ADR ids are not board ids
assert.deepEqual(check(memo({ extra: 'E004 and ADR-5' })), [])

// de-duplication: one flag per (section, id)
const dup = check(memo({ working: 'T001 T001\nT001', next: '1. T001', extra: 'T999 T999', done: '- T999' }))
assert.deepEqual(dup.map(f => f.id), ['contradiction:up-next:T001', 'contradiction:working-on:T001', 'dangling-ref:handoff:T999'])

// ordering: warn before info, then by item id (numeric)
const ord = check(memo({ working: 'T003 T001', extra: 'T005' }), [{ id: 'E001', summary: 'x', body: 'T000' }])
assert.deepEqual(ord.map(f => f.refs[0]), ['T001', 'T003', 'T000', 'T005'])

// formatHealthWarnings: max 5 warns + "more", info-only line
const many: HealthFlag[] = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, kind: 'contradiction', severity: 'warn', message: `m${i}`, refs: [] }))
const block = formatHealthWarnings(many).split('\n')
assert.equal(block[0], '## ⚠ Memory warnings')
assert.equal(block.length, 7)
assert.equal(block[6], '…and 2 more on /memory')
assert.equal(formatHealthWarnings(dang), 'ℹ 3 memory cleanup suggestions on /memory')
assert.equal(formatHealthWarnings(dang.slice(0, 1)), 'ℹ 1 memory cleanup suggestion on /memory')
assert.equal(formatHealthWarnings([...dang, w]), '## ⚠ Memory warnings\n- ⚠ Handoff says T001 is in progress, but it is done')

// ─── duplicates ───
const ent = (id: string, summary: string, body = '', type = 'convention'): DupEntry => ({ id, type, summary, body })
const dups = (list: DupEntry[], threshold?: number) => findDuplicates(list, tokenize, { threshold })
const fsA = ent('E004', 'Only core.ts touches the file system')
const fsB = ent('E011', 'Only core.ts may touch fs')
const pair = dups([fsA, ent('E005', 'Tailwind only'), ent('E006', 'No database'), fsB])
assert.deepEqual(pair, [{
  id: 'duplicate:E004+E011', kind: 'duplicate', severity: 'info', message: 'E004 and E011 look like duplicates (57%)',
  refs: ['E004', 'E011'], suggestion: { action: 'merge', ids: ['E004', 'E011'] },
}])
// unrelated short entries never pair
assert.equal(duplicateScore(ent('E1', 'Tailwind only'), ent('E2', 'No database'), tokenize), 0)
// threshold: the fs pair (0.57) sits above 0.5; a near miss sharing one topic word stays well below
const near = ent('E020', 'core.ts owns the activity log')
assert.ok(duplicateScore(fsA, near, tokenize) <= 0.25)
assert.deepEqual(dups([fsA, near]), [])
assert.deepEqual(dups([fsA, fsB], 0.6), [])
// type penalty: 0.1 off when types differ (drops this pair below the threshold)
const gotcha = { ...fsB, type: 'gotcha' }
assert.ok(Math.abs(duplicateScore(fsA, gotcha, tokenize) - (duplicateScore(fsA, fsB, tokenize) - 0.1)) < 1e-9)
assert.deepEqual(dups([fsA, gotcha]), [])
// different types can still be duplicates when the text is close enough
assert.equal(dups([ent('E1', 'Roadmap positions live in layout.json'), ent('E2', 'Roadmap positions live in layout.json only', '', 'gotcha')]).length, 1)
// body counts (0.4 weight): same summary words, unrelated bodies → lower score than matching bodies
const s1 = ent('E1', 'SSE event bus', 'emitUpdate from API routes after every mutation')
assert.ok(duplicateScore(s1, ent('E2', 'SSE event bus', 'emitUpdate from API routes after mutations'), tokenize) >
  duplicateScore(s1, ent('E3', 'SSE event bus', 'browser reconnects with exponential backoff'), tokenize))
// transitive grouping: E1~E2, E2~E3 (E1 and E3 below threshold) → one group, ids numerically sorted
const chain = [
  ent('E10', 'Roadmap writes take a lock'),
  ent('E2', 'Writes take a lock serially'),
  ent('E3', 'Take the lock serially in a queue'),
]
assert.ok(duplicateScore(chain[0], chain[2], tokenize) < 0.5)
const g = dups(chain)
assert.equal(g.length, 1)
assert.equal(g[0].id, 'duplicate:E2+E3+E10')
assert.match(g[0].message, /^E2, E3 and E10 look like duplicates \(\d+%\)$/)
assert.deepEqual(g[0].suggestion, { action: 'merge', ids: ['E2', 'E3', 'E10'] })
// three mutually similar entries → one flag, not three pairs
assert.equal(dups([fsA, fsB, ent('E012', 'Only core.ts touches fs')]).length, 1)
// stable ids: input order doesn't change the flag; adding a member changes it (dismissal no longer applies)
assert.equal(dups([fsB, near, fsA])[0].id, 'duplicate:E004+E011')
assert.equal(dups([fsA, fsB, ent('E002', 'core.ts touches the file system only')])[0].id, 'duplicate:E002+E004+E011')
// 200 distinct entries (seeded): no false positives
let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const syll = ['ka', 'lo', 'mi', 'ne', 'ru', 'sa', 'ti', 'vo', 'ze', 'qu', 'fi', 'go', 'ha', 'ju', 'py']
const word = () => Array.from({ length: 3 }, () => syll[Math.floor(rand() * syll.length)]).join('')
const pick = (n: number) => Array.from({ length: n }, word).join(' ')
const big = Array.from({ length: 200 }, (_, i) => ent(`E${i + 1}`, `${pick(4)} config`, `${pick(12)} the file`, ['convention', 'gotcha', 'decision'][i % 3]))
assert.deepEqual(dups(big), [])
// …and a real duplicate hidden in it is still found
assert.deepEqual(dups([...big, ent('E900', big[7].summary, big[7].body, big[7].type)]).map(f => f.id), ['duplicate:E8+E900'])
// info severity: never a warning in vibedoc_read_memory
assert.equal(formatHealthWarnings(pair), 'ℹ 1 memory cleanup suggestion on /memory')

console.log('memory-health: all checks passed')
