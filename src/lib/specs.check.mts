// Self-check for specs. Run: node src/lib/specs.check.mts
import assert from 'node:assert/strict'
import { applyDelta, findRequirement, parseSpecChanges, formatRelatedSpecs, formatRequirement, formatSpecContext, formatSpecList, isSpecPath, parseSpec, parseSpecSlugs, taskSection, type SpecContext } from './specs.ts'

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

// taskSection
const taskRaw = '# T1: x\n## Goal\nShip it.\n\n## Acceptance criteria\n- [ ] works\n## Verify\nnpm test'
assert.equal(taskSection(taskRaw, 'Goal'), 'Ship it.')
assert.equal(taskSection(taskRaw, 'Acceptance criteria'), '- [ ] works')
assert.equal(taskSection(taskRaw, 'Scope'), '')

// formatSpecContext: nothing found
const empty: SpecContext = { capability: 'zzz', epics: [], docs: [], entries: [], existing: null }
assert.match(formatSpecContext(empty, 6000), /^Nothing found for "zzz".*epics:/)
// everything shown under budget; instructions propose a new doc
const ctx: SpecContext = {
  capability: 'board-views',
  epics: [{ id: 'R010', title: 'Board views', doneWhen: 'saved views work', tasks: [
    { id: 'T001', title: 'Old', finished: '2026-01-01', goal: 'g1 '.repeat(200), acceptance: '- a1' },
    { id: 'T002', title: 'New', finished: '2026-05-01', goal: 'g2', acceptance: '- a2' },
  ] }],
  docs: [{ path: 'docs/board.md', lines: ['Board views are saved'] }],
  entries: [{ id: 'E001', type: 'convention', summary: 'Views live in the URL' }],
  existing: null,
}
const all = formatSpecContext(ctx, 6000)
for (const want of ['# Spec context: board-views', '## R010: Board views', '**Done when:** saved views work', '### T001: Old (done 2026-01-01)',
  '### T002: New', '- docs/board.md', '  > Board views are saved', '- E001 · convention · Views live in the URL', 'old_string: ""', 'docs/specs/board-views.md']) {
  assert.ok(all.includes(want), want)
}
assert.ok(!all.includes('cut'))
// over budget: the oldest task goes first, and the cut is counted
const small = formatSpecContext(ctx, 400)
assert.ok(!small.includes('### T001') && small.includes('### T002'))
assert.ok(small.includes('(1 older task cut to fit)') && small.includes('1 older task cut to stay under ~400 tokens'))
// an existing spec is shown and the instructions ask for changes to it
const withSpec = formatSpecContext({ ...empty, capability: 'memory', existing: '# Memory\n### Requirement: A' }, 6000)
assert.ok(withSpec.includes('## Existing spec (docs/specs/memory.md)') && withSpec.includes('propose changes to it'))

// ─── R069 spec changes ───
const epicBody = [
  'Outcome.',
  '',
  '## Spec changes',
  '### Memory',
  '#### ADDED Requirement: Entry expiry',
  'The system SHALL expire entries.',
  '',
  '##### Scenario: Old entry',
  '- WHEN an entry is a year old',
  '- THEN it is flagged',
  '#### MODIFIED Requirement: Session budget',
  'The session start SHALL fit 3000 tokens.',
  '```',
  '#### REMOVED Requirement: Not an op (fenced)',
  '```',
  '##### Scenario: Big project',
  '- WHEN there are 300 entries',
  '- THEN it fits',
  '#### REMOVED Requirement: Legacy index',
  'Replaced by recall.',
  '#### RENAMED Requirement: Recall → Keyword recall',
  '### board-views',
  '#### ADDED Requirement: Kanban',
  'It SHALL show columns.',
  '',
  '## Out of scope',
  '#### ADDED Requirement: ignored',
].join('\n')
const changes = parseSpecChanges(epicBody)
assert.deepEqual(changes.map(c => [c.capability, c.ops.map(o => `${o.op} ${o.name}${o.newName ? ` → ${o.newName}` : ''}`)]), [
  ['memory', ['ADDED Entry expiry', 'MODIFIED Session budget', 'REMOVED Legacy index', 'RENAMED Recall → Keyword recall']],
  ['board-views', ['ADDED Kanban']],
])
assert.equal(changes[0].ops[0].text, 'The system SHALL expire entries.\n\n##### Scenario: Old entry\n- WHEN an entry is a year old\n- THEN it is flagged')
assert.match(changes[0].ops[1].text, /```\n#### REMOVED Requirement: Not an op \(fenced\)\n```/)
assert.equal(changes[0].ops[2].text, 'Replaced by recall.')
assert.deepEqual(parseSpecChanges('# no section\n#### ADDED Requirement: x'), [])
assert.deepEqual(parseSpecChanges('```\n## Spec changes\n### m\n#### ADDED Requirement: x\n```'), [])

const specRaw = [
  '# Memory',
  '',
  '## Purpose',
  'Memory things.',
  '',
  '## Requirements',
  '',
  '### Requirement: Session budget',
  'The session start SHALL fit 2000 tokens.',
  '',
  '#### Scenario: Many entries',
  '- WHEN 200 entries',
  '- THEN it fits',
  '',
  '### Requirement: Legacy index',
  'Old.',
  '',
  '### Requirement: Recall',
  'It SHALL rank.',
  '',
  '## Notes',
  'Kept as is.',
  '',
].join('\n')
const { raw: merged, errors } = applyDelta(specRaw, changes[0].ops, 'memory')
assert.deepEqual(errors, [])
const parsed = parseSpec('docs/specs/memory.md', merged)
assert.deepEqual(parsed.requirements.map(r => r.name), ['Session budget', 'Keyword recall', 'Entry expiry'])
// MODIFIED replaced the whole block (old scenario gone, new one in, levels shifted, fence kept as text)
assert.equal(parsed.requirements[0].text.split('\n')[0], 'The session start SHALL fit 3000 tokens.')
assert.deepEqual(parsed.requirements[0].scenarios.map(s => s.name), ['Big project'])
assert.ok(merged.includes('```\n#### REMOVED Requirement: Not an op (fenced)\n```'))
// ADDED went after the last requirement, before ## Notes, with its scenario one level up
assert.deepEqual(parsed.requirements[2], { name: 'Entry expiry', text: 'The system SHALL expire entries.', scenarios: [{ name: 'Old entry', text: '- WHEN an entry is a year old\n- THEN it is flagged' }] })
// text outside the touched blocks is byte-for-byte the same
assert.ok(merged.startsWith('# Memory\n\n## Purpose\nMemory things.\n\n## Requirements\n\n### Requirement: Session budget\n'))
assert.ok(merged.endsWith('\n## Notes\nKept as is.\n'))
assert.ok(!merged.includes('Legacy index') && !merged.includes('Old.'))
// applying the same delta twice reports errors instead of duplicating (MODIFIED is a replace, so it applies again)
const again = applyDelta(merged, changes[0].ops, 'memory')
assert.deepEqual(again.errors, [
  'ADDED "Entry expiry": the spec already has this requirement',
  'REMOVED "Legacy index": no such requirement in the spec',
  'RENAMED "Recall": no such requirement in the spec',
])
assert.equal(again.raw, merged)
// each error on its own
assert.deepEqual(applyDelta(specRaw, [{ op: 'MODIFIED', name: 'Nope', text: 'x' }]).errors, ['MODIFIED "Nope": no such requirement in the spec'])
assert.deepEqual(applyDelta(specRaw, [{ op: 'REMOVED', name: 'nope', text: '' }]).errors, ['REMOVED "nope": no such requirement in the spec'])
assert.deepEqual(applyDelta(specRaw, [{ op: 'RENAMED', name: 'Recall', text: '' }]).errors, ['RENAMED "Recall": give the new name as "Old → New"'])
assert.deepEqual(applyDelta(specRaw, [{ op: 'RENAMED', name: 'Recall', newName: 'session budget', text: '' }]).errors, ['RENAMED "Recall": "session budget" already exists'])
assert.deepEqual(applyDelta(specRaw, [{ op: 'ADDED', name: 'recall', text: 'x' }]).errors, ['ADDED "recall": the spec already has this requirement'])
// an erroring op leaves the spec unchanged
assert.equal(applyDelta(specRaw, [{ op: 'REMOVED', name: 'nope', text: '' }]).raw, specRaw)
// a requirement block ends at the next ### heading: REMOVED takes its scenarios along
const noBudget = applyDelta(specRaw, [{ op: 'REMOVED', name: 'Session budget', text: '' }]).raw
assert.ok(!noBudget.includes('Many entries'))
assert.deepEqual(parseSpec('x', noBudget).requirements.map(r => r.name), ['Legacy index', 'Recall'])

// new spec: null + ADDED only → H1 from the capability; anything else on null → errors
const fresh = applyDelta(null, changes[1].ops, 'board-views')
assert.deepEqual(fresh.errors, [])
assert.ok(fresh.raw.startsWith('# Board views\n'))
assert.deepEqual(parseSpec('docs/specs/board-views.md', fresh.raw).requirements, [{ name: 'Kanban', text: 'It SHALL show columns.', scenarios: [] }])
assert.deepEqual(applyDelta(null, [{ op: 'MODIFIED', name: 'X', text: 'y' }]), { raw: '', errors: ['MODIFIED "X": no such requirement in the spec'] })
// a spec with no requirement yet: ADDED is appended at the end
const noReqs = applyDelta('# M\n\nIntro.\n', [{ op: 'ADDED', name: 'A', text: 'It SHALL.' }]).raw
assert.equal(noReqs, '# M\n\nIntro.\n\n### Requirement: A\nIt SHALL.\n')

console.log('specs ok')
