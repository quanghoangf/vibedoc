// Self-check for specs. Run: node src/lib/specs.check.mts
import assert from 'node:assert/strict'
import { findRequirement, formatRelatedSpecs, formatRequirement, formatSpecList, isSpecPath, parseSpec, parseSpecSlugs } from './specs.ts'

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

// parseSpecSlugs
assert.deepEqual(parseSpecSlugs('board-views, Memory  roadmap,board-views'), ['board-views', 'memory', 'roadmap'])
assert.deepEqual(parseSpecSlugs('—'), [])
assert.deepEqual(parseSpecSlugs(undefined), [])

// formatRelatedSpecs: declared (all names), ranked (a few), empty
assert.equal(formatRelatedSpecs([]), '')
assert.equal(formatRelatedSpecs([
  { capability: 'board-views', title: 'Board views', names: ['Saved views', 'Table view'] },
  { capability: 'memory', title: 'Memory', names: [] },
]), [
  '## Related spec',
  'Board views · docs/specs/board-views.md',
  '- Saved views',
  '- Table view',
  'Memory · docs/specs/memory.md',
  '- (no requirements yet)',
  'Read with vibedoc_get_spec { capability, requirement? }',
].join('\n'))
// the line cap spans groups
const many = formatRelatedSpecs([
  { capability: 'a', title: 'A', names: Array.from({ length: 12 }, (_, i) => `a${i}`) },
  { capability: 'b', title: 'B', names: Array.from({ length: 6 }, (_, i) => `b${i}`) },
])
assert.equal(many.split('\n').filter(l => /^- [ab]\d/.test(l)).length, 15)
assert.ok(many.includes('- … 3 more'))

// formatSpecList / findRequirement / formatRequirement
const boardSpec = parseSpec('docs/specs/board-views.md', full)
assert.equal(formatSpecList([boardSpec, parseSpec('docs/specs/memory.md', '# Memory')]), [
  '- board-views · Board views · 2 requirements · 2 scenarios',
  '- memory · Memory · 0 requirements · 0 scenarios',
].join('\n'))
assert.match(formatSpecList([]), /^No capability specs yet/)
const saved = findRequirement(boardSpec, 'saved VIEWS ')
assert.ok(saved)
assert.equal(findRequirement(boardSpec, 'nope'), null)
assert.equal(formatRequirement(saved), [
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
].join('\n'))
// a requirement parsed back from its own markdown is the same requirement
assert.deepEqual(parseSpec('docs/specs/x.md', formatRequirement(saved)).requirements[0], saved)

console.log('specs ok')
