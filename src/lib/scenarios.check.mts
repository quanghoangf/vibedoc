// Self-check for scenarios. Run: node src/lib/scenarios.check.mts
import assert from 'node:assert/strict'
import { coverageOf, parseCovers, parseScenarios } from './scenarios.ts'

const body = [
  'Intro text.',
  '',
  '## Scenarios',
  '### S1: Break down an epic with scenarios',
  '- WHEN the user breaks down an epic with three scenarios',
  '- THEN every scenario is covered by at least one task',
  '',
  '### s02 — Evidence per scenario',
  '- WHEN a covering task has a passing run',
  '- THEN the scenario shows passed',
  '```',
  '### S9: inside a fence',
  '```',
  '### S1: duplicate id',
  '- ignored',
  '',
  '## Out of scope',
  '### S3: after the section',
].join('\n')
assert.deepEqual(parseScenarios(body), [
  { id: 'S1', name: 'Break down an epic with scenarios', text: '- WHEN the user breaks down an epic with three scenarios\n- THEN every scenario is covered by at least one task' },
  // the fence stays in the previous scenario's text, but is never a scenario itself
  { id: 'S2', name: 'Evidence per scenario', text: '- WHEN a covering task has a passing run\n- THEN the scenario shows passed\n```\n### S9: inside a fence\n```' },
])
// no section; a fenced section heading
assert.deepEqual(parseScenarios('# x\n### S1: y'), [])
assert.deepEqual(parseScenarios('```\n## Scenarios\n### S1: a\n```'), [])
// CRLF
assert.equal(parseScenarios('## Scenarios\r\n### S1: a\r\n- WHEN b\r\n')[0].text, '- WHEN b')

// parseCovers
assert.deepEqual(parseCovers('S1, s3 S3'), ['S1', 'S3'])
assert.deepEqual(parseCovers('S01,S2;x'), ['S1', 'S2'])
assert.deepEqual(parseCovers('—'), [])
assert.deepEqual(parseCovers(undefined), [])
assert.deepEqual(parseCovers('XS1 S1a'), [])

// coverageOf
assert.deepEqual(coverageOf(parseScenarios(body), [{ id: 'T1', covers: ['S2'] }, { id: 'T2', covers: ['S2', 'S7'] }]), { S1: [], S2: ['T1', 'T2'] })

console.log('scenarios ok')
