// Self-check for claude-memory. Run: node src/lib/claude-memory.check.mts
import assert from 'node:assert/strict'
import { claudeProjectSlug, mapClaudeType, parseClaudeMemory, planImport } from './claude-memory.ts'
import type { Entry } from './entries.ts'

// claudeProjectSlug: "/", "." and spaces all become "-"
assert.equal(claudeProjectSlug('/Users/x/work/vibedoc'), '-Users-x-work-vibedoc')
assert.equal(claudeProjectSlug('/Users/x/my app/v1.2'), '-Users-x-my-app-v1-2')

// mapClaudeType: each mapping, case, missing
assert.equal(mapClaudeType('feedback'), 'preference')
assert.equal(mapClaudeType('user'), 'preference')
assert.equal(mapClaudeType('project'), 'decision')
assert.equal(mapClaudeType('reference'), 'convention')
assert.equal(mapClaudeType('Project'), 'decision')
assert.equal(mapClaudeType('other'), 'convention')
assert.equal(mapClaudeType(undefined), 'convention')

// current shape: type under metadata:
const nested = '---\nname: only-core-touches-fs\ndescription: API routes import from core.ts, never fs\nmetadata:\n  type: feedback\n---\n\nWhy: one place.\n'
assert.deepEqual(parseClaudeMemory(nested, 'only-core-touches-fs.md'), {
  name: 'only-core-touches-fs', type: 'preference', summary: 'API routes import from core.ts, never fs', body: 'Why: one place.', file: 'only-core-touches-fs.md',
})

// older shape: type at the top level; quotes and CRLF ok
const flat = '---\r\nname: "use-pnpm"\r\ndescription: \'npm fails on the lock file\'\r\ntype: project\r\n---\r\nbody\r\n'
assert.deepEqual(parseClaudeMemory(flat, 'f'), { name: 'use-pnpm', type: 'decision', summary: 'npm fails on the lock file', body: 'body', file: 'f' })

// no type → convention; empty body ok
assert.equal(parseClaudeMemory('---\nname: a\ndescription: b\n---\n', 'f')?.type, 'convention')
assert.equal(parseClaudeMemory('---\nname: a\ndescription: b\n---\n', 'f')?.body, '')

// long description → cut to 120 chars
const long = parseClaudeMemory(`---\nname: a\ndescription: ${'word '.repeat(40)}\n---\n`, 'f')
assert.ok(long && long.summary.length <= 120 && !long.summary.endsWith(' '))

// multi-line description: wrapped and block values fold onto one line
assert.equal(parseClaudeMemory('---\nname: a\ndescription: first part\n  second part\ntype: user\n---\n', 'f')?.summary, 'first part second part')
const block = parseClaudeMemory('---\nname: a\ndescription: >\n  folded\n  text\nmetadata:\n  type: user\n---\n', 'f')
assert.equal(block?.summary, 'folded text')
assert.equal(block?.type, 'preference')

// null: no frontmatter, unclosed frontmatter, no name, no description
assert.equal(parseClaudeMemory('# Memory index\n- [a](a.md)\n', 'MEMORY.md'), null)
assert.equal(parseClaudeMemory('---\nname: a\ndescription: b\n', 'f'), null)
assert.equal(parseClaudeMemory('---\ndescription: b\n---\n', 'f'), null)
assert.equal(parseClaudeMemory('---\nname: a\ndescription:\n---\n', 'f'), null)

// planImport: dedupe by source only
const cand = (name: string, summary = name, body = '') => ({ name, type: 'convention' as const, summary, body, file: `${name}.md` })
const ent = (id: string, summary: string, source?: string, body = ''): Entry =>
  ({ id, type: 'convention', summary, body, updatedAt: '2026-10-01', by: 'human', ...(source ? { source } : {}), file: `memory/entries/${id}-x.md` })
const plan = planImport(
  [cand('same', 'Same'), cand('changed', 'New text'), cand('fresh', 'Fresh'), cand('native', 'Native'), cand('same', 'Dup')],
  [ent('E001', 'Same', 'claude-code:same'), ent('E002', 'Old text', 'claude-code:changed'), ent('E003', 'Native'), ent('E004', 'Gone', 'claude-code:gone')],
)
assert.deepEqual(plan.create.map(c => c.name), ['fresh', 'native']) // E003 has no source → never matched, even with the same summary
assert.deepEqual(plan.update.map(u => [u.entry.id, u.candidate.summary]), [['E002', 'New text']])
assert.deepEqual(plan.unchanged.map(u => u.entry.id), ['E001']) // the repeated "same" counts once
assert.deepEqual(plan.onlyInVibedoc.map(e => e.id), ['E004'])
// body or type difference alone → update
assert.equal(planImport([cand('same', 'Same', 'new body')], [ent('E001', 'Same', 'claude-code:same')]).update.length, 1)
assert.equal(planImport([{ ...cand('same', 'Same'), type: 'gotcha' }], [ent('E001', 'Same', 'claude-code:same')]).update.length, 1)
// a non-claude source is neither matched nor "only in VibeDoc"
assert.deepEqual(planImport([], [ent('E001', 'x', 'cursor:x')]).onlyInVibedoc, [])

console.log('claude-memory: ok')
