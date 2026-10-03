// Self-check for memory-sections. Run: node src/lib/memory-sections.check.mts
import assert from 'node:assert/strict'
import { mergeMemory, parseMemory, joinMemory } from './memory-sections.ts'

const stamp = '2026-10-03 at 09:00 AM'

// a missing file renders the old full template, byte for byte
const oldTemplate = (currentState: string, handoff: string) =>
  `# Project Memory\n**Last updated:** ${stamp}\n\n## Current state\n${currentState}\n\n## Just completed\n- (nothing this session)\n\n## Working on now\n(nothing active)\n\n## Up next\n1. (define next steps)\n\n## Active issues\n| Issue | Severity | Status |\n|-------|----------|--------|\n| None | — | — |\n\n## Recent decisions\n- (none this session)\n\n## Tech debt\n- (none noted)\n\n## Handoff for next session\n${handoff}\n`
assert.equal(mergeMemory('', { currentState: 'All good', handoff: 'Carry on' }, stamp), oldTemplate('All good', 'Carry on'))
assert.equal(mergeMemory('  \n', { currentState: 'All good', handoff: 'Carry on' }, stamp), oldTemplate('All good', 'Carry on'))

// lossless parse, fences respected
const md = `# Project Memory\n**Last updated:** 2026-01-01 at 10:00 AM\n\n## Current state\nOld state.\n\n## Key conventions\n- keep me\n\`\`\`md\n## Up next\nnot a heading\n\`\`\`\n\n## Up next\n1. a\n\n## Handoff for next session\nold handoff\n`
const parsed = parseMemory(md)
assert.equal(joinMemory(parsed), md)
assert.deepEqual(parsed.sections.map(s => s.heading), ['Current state', 'Key conventions', 'Up next', 'Handoff for next session'])
for (const s of ['', 'no headings', '## A', '## A\n', 'x\r\n## B\r\nb\r\n', '```\n## X\n']) assert.equal(joinMemory(parseMemory(s)), s)

// only the handoff + Last updated change
const h = mergeMemory(md, { handoff: 'x' }, stamp)
assert.equal(h, md.replace('2026-01-01 at 10:00 AM', stamp).replace('old handoff', 'x'))

// the fenced "## Up next" in Key conventions is not replaced
const u = mergeMemory(md, { upNext: ['b', 'c'] }, stamp)
assert.equal(u, md.replace('2026-01-01 at 10:00 AM', stamp).replace('## Up next\n1. a\n', '## Up next\n1. b\n2. c\n'))

// case-insensitive heading match, lists replace (no append), empty list → placeholder
assert.ok(mergeMemory('# M\n\n## up NEXT\n1. a\n', { upNext: [] }, stamp).endsWith('## up NEXT\n1. (define next steps)\n'))

// missing sections are inserted in template order, after the last known one before them
const m = mergeMemory(md, { workingOn: 'T123', techDebt: ['d'] }, stamp)
assert.deepEqual(parseMemory(m).sections.map(s => s.heading),
  ['Current state', 'Working on now', 'Key conventions', 'Up next', 'Tech debt', 'Handoff for next session'])
assert.ok(m.includes('## Current state\nOld state.\n\n## Working on now\nT123\n\n## Key conventions\n'))
assert.ok(m.includes('## Up next\n1. a\n\n## Tech debt\n- d\n\n## Handoff for next session\n'))
// none before → before the first known after it; none at all → at the end, with a blank line above
assert.equal(mergeMemory('# M\n\n## Up next\n1. a\n', { currentState: 's' }, stamp), `# M\n**Last updated:** ${stamp}\n\n## Current state\ns\n\n## Up next\n1. a\n`)
assert.equal(mergeMemory('# M\n\n## Notes\nn\n', { handoff: 'h' }, stamp), `# M\n**Last updated:** ${stamp}\n\n## Notes\nn\n\n## Handoff for next session\nh\n`)
// issues table keeps its format
assert.ok(mergeMemory(md, { issues: ['a', { issue: 'b', severity: 'low' }] }, stamp)
  .includes('## Active issues\n| Issue | Severity | Status |\n|-------|----------|--------|\n| a | medium | open |\n| b | low | open |\n\n## Handoff'))

// Last updated: replaced, or inserted under the H1
assert.equal(mergeMemory('# Mem\n\n## Handoff for next session\nh\n', { handoff: 'n' }, stamp), `# Mem\n**Last updated:** ${stamp}\n\n## Handoff for next session\nn\n`)

// zero known fields → error
assert.throws(() => mergeMemory(md, {}, stamp), /Nothing to update: pass at least one of currentState/)
assert.throws(() => mergeMemory(md, { bogus: 1 } as never, stamp), /Nothing to update/)

console.log('memory-sections: ok')
