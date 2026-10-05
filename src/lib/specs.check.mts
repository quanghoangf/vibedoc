// Self-check for specs. Run: node src/lib/specs.check.mts
import assert from 'node:assert/strict'
import { isSpecPath, parseSpec } from './specs.ts'

// a full spec
const full = [
  '# Board views',
  '',
  '## Purpose',
  'How /board shows tasks.',
  '',
  '## Requirements',
  '',
  '### Requirement: Saved views',
  'The board SHALL keep named views.',
  '',
  '#### Scenario: Save a view',
  '- WHEN the user saves the current filters as "Mine"',
  '- THEN "Mine" shows in the view list',
  '',
  '#### Scenario: Open a view',
  '- WHEN the user picks "Mine"',
  '- THEN the board shows its filters',
  '',
  '### Requirement: Table view',
  'The board MUST offer a table.',
  '#### Notes',
  'Columns are sortable.',
  '',
  '## Open questions',
  'none',
].join('\n')
assert.deepEqual(parseSpec('docs/specs/board-views.md', full), {
  capability: 'board-views',
  title: 'Board views',
  purpose: 'How /board shows tasks.',
  requirements: [
    {
      name: 'Saved views', text: 'The board SHALL keep named views.', scenarios: [
        { name: 'Save a view', text: '- WHEN the user saves the current filters as "Mine"\n- THEN "Mine" shows in the view list' },
        { name: 'Open a view', text: '- WHEN the user picks "Mine"\n- THEN the board shows its filters' },
      ],
    },
    // a requirement with no scenario; a deeper non-scenario heading stays in its text
    { name: 'Table view', text: 'The board MUST offer a table.\n#### Notes\nColumns are sortable.', scenarios: [] },
  ],
})

// no requirements: still a spec; purpose falls back to the prose before the first ##
assert.deepEqual(parseSpec('docs/specs/memory.md', '# Memory\n\nWhat memory does.\n\n## Later\nx'), {
  capability: 'memory', title: 'Memory', purpose: 'What memory does.', requirements: [],
})
// no H1: title = the capability
assert.equal(parseSpec('docs/specs/roadmap.md', '').title, 'roadmap')

// headings inside a fence are not requirements
const fencedSpec = '# X\n```md\n### Requirement: Fake\n#### Scenario: Fake\n```\n### Requirement: Real\nIt SHALL work.'
assert.deepEqual(parseSpec('docs/specs/x.md', fencedSpec).requirements.map(r => r.name), ['Real'])
// the fence stays in the requirement's text when it sits inside one
assert.equal(parseSpec('docs/specs/x.md', '### Requirement: A\n```\n#### Scenario: no\n```').requirements[0].scenarios.length, 0)

// a scenario before any requirement is ignored
assert.deepEqual(parseSpec('docs/specs/x.md', '#### Scenario: Lost\n- WHEN x').requirements, [])

// isSpecPath
assert.equal(isSpecPath('docs/specs/board-views.md'), true)
assert.equal(isSpecPath('./docs/specs/board-views.md'), true)
assert.equal(isSpecPath('docs/specs/sub/board-views.md'), false)
assert.equal(isSpecPath('docs/board-views.md'), false)
assert.equal(isSpecPath('docs/specs/board-views.txt'), false)
assert.equal(isSpecPath('other/docs/specs/a.md'), false)

console.log('specs ok')
