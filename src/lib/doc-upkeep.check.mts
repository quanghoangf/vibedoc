// Self-check for doc upkeep. Run: node src/lib/doc-upkeep.check.mts
import assert from 'node:assert/strict'
import { fixDocsPrompt, outdatedRefs, parseNameStatusLog } from './doc-upkeep.ts'

const log = [
  '\x1eccc\x1ffeat: more (T003)', '', 'M\tsrc/x.ts', 'R100\tsrc/b.ts\tsrc/c.ts', '',
  '\x1ebbb\x1frefactor: move a (T001)', '', 'R087\tsrc/a.ts\tsrc/b.ts', 'D\tsrc/old.ts', 'A\tsrc/new.ts', '',
  '\x1eaaa\x1fchore: init', '', 'A\tsrc/a.ts', '',
].join('\n')
const commits = parseNameStatusLog(log)
assert.deepEqual(commits.map(c => [c.sha, c.subject, c.changes.length]), [
  ['ccc', 'feat: more (T003)', 1], ['bbb', 'refactor: move a (T001)', 2], ['aaa', 'chore: init', 0],
])
assert.deepEqual(commits[1].changes, [{ status: 'R', from: 'src/a.ts', to: 'src/b.ts' }, { status: 'D', from: 'src/old.ts' }])

const doc = { path: 'docs/guide.md', raw: '# Guide\n\nSee `src/a.tsx` and src/olds.ts.\nThe entry is `src/a.ts`.\nGone: src/old.ts.\n' }
const run = (doneTaskIds: string[], docs = [doc], exists = (_: string) => false) => outdatedRefs({ docs, commits, doneTaskIds: new Set(doneTaskIds), exists })

// rename followed through the later rename (a → b → c), delete; word boundaries: a.tsx / olds.ts don't match
assert.deepEqual(run(['T001', 'T003']), [
  { path: 'docs/guide.md', line: 4, taskId: 'T001', from: 'src/a.ts', to: 'src/c.ts' },
  { path: 'docs/guide.md', line: 5, taskId: 'T001', from: 'src/old.ts' },
])
// the later rename's task isn't done: still resolved to where the file is now
assert.equal(run(['T001'])[0].to, 'src/c.ts')
// the task isn't done → nothing; the old path exists again → nothing; a doc not naming it → nothing
assert.deepEqual(run(['T003']), [])
assert.deepEqual(run(['T001'], [doc], p => p === 'src/a.ts').map(r => r.from), ['src/old.ts'])
assert.deepEqual(run(['T001'], [{ path: 'docs/x.md', raw: '# X\nnothing here\n' }]), [])
// T0011 is not T001
assert.deepEqual(outdatedRefs({ docs: [doc], commits: parseNameStatusLog('\x1ed\x1fx (T0011)\n\nD\tsrc/old.ts\n'), doneTaskIds: new Set(['T001']), exists: () => false }), [])

console.log('doc-upkeep: ok')

const prompt = fixDocsPrompt('docs/guide.md', [
  { line: 1, level: 'warn', rule: 'orphan-doc', message: 'No other file links to this doc' },
  { line: 5, level: 'warn', rule: 'outdated-ref', message: 'x', target: 'src/a.ts', task: 'T001', renamedTo: 'src/b.ts' },
  { line: 9, level: 'warn', rule: 'outdated-ref', message: 'y', target: 'src/old.ts', task: 'T001' },
])
assert.match(prompt, /^Fix docs: docs\/guide\.md may be outdated/)
assert.match(prompt, /- L5: T001 renamed `src\/a\.ts` → `src\/b\.ts`/)
assert.match(prompt, /- L9: T001 deleted `src\/old\.ts`/)
assert.match(prompt, /- L1 warn orphan-doc: No other file links to this doc/)
assert.match(prompt, /T001 with vibedoc_get_task/)
assert.match(prompt, /vibedoc_propose_edit, never write the doc directly/)
assert.match(prompt, /vibedoc_check_docs with path "docs\/guide\.md"/)
console.log('fixDocsPrompt: ok')
