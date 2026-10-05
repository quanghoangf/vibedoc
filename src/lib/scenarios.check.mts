// Self-check for scenarios. Run: node src/lib/scenarios.check.mts
import assert from 'node:assert/strict'
import { coverage, coverageOf, scenarioStatus, parseCovers, parseScenarios, scenarioStep, seedSteps } from './scenarios.ts'

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

// scenarioStep / seedSteps
const sc = parseScenarios('## Scenarios\n### S1: One\n- WHEN a\n- AND b\n- THEN c\n- AND d\n### S2: Bare\n### S3: Three\n- THEN only')
assert.equal(scenarioStep(sc[0]), 'S1 — WHEN a AND b → THEN c AND d')
assert.equal(scenarioStep(sc[1]), 'S2 — Bare')
assert.equal(scenarioStep(sc[2]), 'S3 — THEN only')
assert.equal(seedSteps(sc, ['S3', 'S1']), '### Steps\n- [ ] S1 — WHEN a AND b → THEN c AND d\n- [ ] S3 — THEN only')
assert.equal(seedSteps(sc, ['S9']), '')

// coverage: uncovered scenarios, untied tasks; cancelled ignored; no scenarios → nothing untied
const three = parseScenarios('## Scenarios\n### S1: a\n### S2: b\n### S3: c')
assert.deepEqual(coverage(three, [{ id: 'T1', covers: ['S1'] }, { id: 'T2', covers: ['S2'] }, { id: 'T3', covers: ['S3'], status: 'cancelled' }, { id: 'T4' }]),
  { uncovered: ['S3'], untied: ['T4'] })
assert.deepEqual(coverage([], [{ id: 'T1' }]), { uncovered: [], untied: [] })

// scenarioStatus
{
  const task = (id: string, covers: string[], items: [string, boolean, boolean][], autoResult: 'passed' | 'failed' | null = null) =>
    ({ id, covers, autoResult, items: items.map(([text, checked, auto]) => ({ text, checked, auto })) })
  const ticked = task('T1', ['S1'], [['S1 — WHEN a → THEN b', true, true]], 'passed')
  const failedRun = task('T2', ['S2'], [['S2 — WHEN c → THEN d', false, true]], 'failed')
  const open = task('T3', ['S3'], [['S3 — x', false, false]])
  const unverified = task('T4', ['S4'], [['S4 — y', false, true]], 'passed') // a passing run that left it unticked
  const tasks = [ticked, failedRun, open, unverified]
  assert.deepEqual(scenarioStatus('S1', tasks), { status: 'passed', task: 'T1' })
  assert.deepEqual(scenarioStatus('S2', tasks), { status: 'failed', task: 'T2' })
  assert.deepEqual(scenarioStatus('S3', tasks), { status: 'unproven', task: 'T3' })
  assert.deepEqual(scenarioStatus('S4', tasks), { status: 'unproven', task: 'T4' })
  assert.deepEqual(scenarioStatus('S9', tasks), { status: 'unproven', task: null })
  // every covering task must prove it; a failing one wins
  assert.equal(scenarioStatus('S1', [ticked, task('T5', ['S1'], [['S1 — z', false, false]])]).status, 'unproven')
  assert.deepEqual(scenarioStatus('S1', [ticked, task('T6', ['S1'], [['S1 - z', false, true]], 'failed')]), { status: 'failed', task: 'T6' })
  // a covering task whose checklist lost the step: unproven; S1 never matches S10
  assert.equal(scenarioStatus('S1', [task('T7', ['S1'], [['other', true, false]])]).status, 'unproven')
  assert.equal(scenarioStatus('S1', [task('T8', ['S1'], [['S10 — x', true, false]])]).status, 'unproven')
}

console.log('scenarios ok')
