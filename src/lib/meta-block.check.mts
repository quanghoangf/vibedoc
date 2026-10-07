// node src/lib/meta-block.check.mts
import assert from 'node:assert/strict'
import { parseMetaBlock, stripMetaBlock } from './meta-block.ts'

const task = '# T1: Thing\n**Status:** 👀 Review\n**Phase:** R078 — i18n\n**Depends on:** T2, T3\n\n## Goal\n**Key:** body line\n'
const b = parseMetaBlock(task)
assert.deepEqual(b.entries, [{ key: 'Status', value: '👀 Review' }, { key: 'Phase', value: 'R078 — i18n' }, { key: 'Depends on', value: 'T2, T3' }])
assert.equal(b.start, 1); assert.equal(b.end, 4)
assert.equal(stripMetaBlock(task), '# T1: Thing\n\n## Goal\n**Key:** body line\n')

// blank lines between H1 and block
const gap = '# R1: Epic\n\n**Parent:** R002\n**Status:** planned\n\nBody'
assert.deepEqual(parseMetaBlock(gap).entries.map(e => e.key), ['Parent', 'Status'])
assert.equal(stripMetaBlock(gap), '# R1: Epic\n\nBody')

// no block: start = end = line after H1, text untouched
const plain = '# Doc\n\nSome text\n**Key:** lower in the body\n'
assert.deepEqual(parseMetaBlock(plain), { entries: [], start: 1, end: 1 })
assert.equal(stripMetaBlock(plain), plain)

// `# ` inside a fence is not the H1; a meta line inside a fence is untouched
const fenced = '```\n# not a title\n**Status:** fake\n```\n# Real\n**Status:** done\n'
assert.deepEqual(parseMetaBlock(fenced).entries, [{ key: 'Status', value: 'done' }])
assert.equal(stripMetaBlock(fenced), '```\n# not a title\n**Status:** fake\n```\n# Real\n')

// frontmatter is skipped (a YAML `# comment` is not the H1) and kept
const fm = '---\n# yaml comment\npriority: P1\n---\n# Title\n**Owner:** human\n\nText'
assert.deepEqual(parseMetaBlock(fm).entries, [{ key: 'Owner', value: 'human' }])
assert.equal(stripMetaBlock(fm), '---\n# yaml comment\npriority: P1\n---\n# Title\n\nText')

// no H1: a block at the very top still counts; empty value kept
assert.deepEqual(parseMetaBlock('**Status:**\nx').entries, [{ key: 'Status', value: '' }])
assert.equal(parseMetaBlock('').end, 0)

console.log('meta-block ok')
