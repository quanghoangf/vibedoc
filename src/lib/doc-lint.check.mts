// Self-check for doc lint. Run: node src/lib/doc-lint.check.mts
import assert from 'node:assert/strict'
import { formatLint, lintDocs, summarizeLint, type LintFile } from './doc-lint.ts'
import { buildDocGraph, docNode, extractLinks } from './doc-links.ts'
import { parseSpec } from './specs.ts'

const graphOf = (files: LintFile[]) => buildDocGraph(files.map(f => ({ node: docNode(f.path, f.raw), links: extractLinks(f.raw, f.path) })))
const lint = (files: LintFile[], path?: string) => lintDocs(files, graphOf(files), { path })
const rules = (files: LintFile[], path?: string) => lint(files, path).map(i => `${i.path}:${i.line} ${i.level} ${i.rule}`)

// clean project
const clean = [
  { path: 'docs/a.md', raw: '# A\n\nSee [b](b.md).\n' },
  { path: 'docs/b.md', raw: '---\npriority: P1\ntags:\n  - x\n# comment\n---\n# B\n\nBack to [a](./a.md).\n' },
]
assert.deepEqual(lint(clean), [])
assert.equal(formatLint(summarizeLint([], 2)), '✅ Docs check: no issues in 2 files')

// broken link (error, with target) and stale backticked path (warn)
const linky = [{ path: 'notes/a.md', raw: '# A\n\n[gone](missing.md)\nsee `docs/nope.md`\n' }]
assert.deepEqual(rules(linky), ['notes/a.md:3 error broken-link', 'notes/a.md:4 warn stale-path'])
assert.equal(lint(linky)[0].target, 'missing.md')

// frontmatter: unclosed, and a line that isn't key: value
assert.deepEqual(rules([{ path: 'x.md', raw: '---\ntitle: X\n# X\n' }]), ['x.md:1 error bad-frontmatter'])
assert.deepEqual(rules([{ path: 'x.md', raw: '---\nkey: v\nnot yaml here\n---\n# X\n' }]), ['x.md:3 error bad-frontmatter'])

// no H1 (warn, line after frontmatter); `title:` in frontmatter counts as one; an H1 inside a fence doesn't
assert.deepEqual(rules([{ path: 'x.md', raw: 'just text\n' }]), ['x.md:1 warn no-h1'])
assert.deepEqual(rules([{ path: 'x.md', raw: '---\nk: v\n---\n## Sub\n' }]), ['x.md:4 warn no-h1'])
assert.deepEqual(rules([{ path: 'x.md', raw: '---\ntitle: Install\n---\nBody\n' }]), [])
assert.deepEqual(rules([{ path: 'x.md', raw: '```\n# not a title\n```\n' }]), ['x.md:1 warn no-h1'])

// empty doc (also after frontmatter); no extra no-h1
assert.deepEqual(rules([{ path: 'x.md', raw: '  \n\n' }]), ['x.md:1 warn empty-doc'])
assert.deepEqual(rules([{ path: 'x.md', raw: '---\nk: v\n---\n\n' }]), ['x.md:1 warn empty-doc'])

// path filter: only that file, links still resolved project-wide
const two = [...linky, { path: 'notes/c.md', raw: 'no title' }]
assert.deepEqual(rules(two, 'notes/c.md'), ['notes/c.md:1 warn no-h1'])
assert.deepEqual(rules(two, './notes/a.md').length, 2)

// summary + format: counts, grouped by file, errors' files first, cap
const s = summarizeLint(lint(two), 2)
assert.deepEqual([s.errors, s.warnings, s.files], [1, 2, 2])
const text = formatLint(s)
assert.match(text, /^🩺 Docs check: 1 error · 2 warnings in 2 of 2 files/)
assert.ok(text.indexOf('**notes/a.md**') < text.indexOf('**notes/c.md**'))
assert.match(text, / {2}L3 error broken-link: Link to "missing.md" points to no file/)
assert.match(formatLint(s, 1), /… 2 more\. Pass `path` to check one file\./)

// orphan: a docs/** doc nobody links to (warn); a link from anywhere clears it; non-docs files never count
assert.deepEqual(rules([{ path: 'docs/lonely.md', raw: '# L\n' }, { path: 'README.md', raw: '# R\n' }]), ['docs/lonely.md:1 warn orphan-doc'])
assert.deepEqual(rules([{ path: 'docs/lonely.md', raw: '# L\n' }, { path: 'README.md', raw: '# R\n[l](docs/lonely.md)\n' }]), [])

// spec structure: no requirements, duplicate requirement, scenario without THEN (line = its heading)
const specFile = (raw: string) => ({ path: 'docs/specs/memory.md', raw })
const specRules = (raw: string) => {
  const f = specFile(raw)
  const files = [f, { path: 'README.md', raw: '# R\n[m](docs/specs/memory.md)\n' }]
  return lintDocs(files, graphOf(files), { specs: [{ path: f.path, spec: parseSpec(f.path, f.raw) }] }).map(i => `${i.line} ${i.rule}: ${i.message}`)
}
assert.deepEqual(specRules('# Memory\n\nNothing yet.\n'), ['1 spec-structure: Capability spec has no "### Requirement:" heading'])
const spec = ['# Memory', '', '### Requirement: Save', 'It SHALL save.', '#### Scenario: ok', '- WHEN x', '- THEN y',
  '#### Scenario: half', '- WHEN x', '', '### Requirement: Save', 'Again.'].join('\n')
assert.deepEqual(specRules(spec), [
  '8 spec-structure: Scenario "half" has no THEN bullet',
  '11 spec-structure: Requirement "Save" appears more than once',
])

// spec changes (error): line = the op heading, else the capability heading, else ## Spec changes
const epic = { path: 'plans/roadmap/R001-x.md', raw: ['# R001: X', '', '## Spec changes', '### memory', '#### MODIFIED Requirement: Ghost', 'text'].join('\n') }
const ch = (op: string, name: string, capability = 'memory') => lintDocs([epic], graphOf([epic]), { specChanges: [{ path: epic.path, capability, op, name, message: 'boom' }] })
  .map(i => `${i.line} ${i.level} ${i.rule}: ${i.message}`)
assert.deepEqual(ch('MODIFIED', 'Ghost'), ['5 error spec-changes: Spec changes for "memory": boom'])
assert.deepEqual(ch('', '', 'memory'), ['4 error spec-changes: Spec changes for "memory": boom'])
assert.deepEqual(ch('', '', 'Not A Slug'), ['3 error spec-changes: Spec changes for "Not A Slug": boom'])

// heading: the section an issue sits in, for viewers to scroll to
const sec = lint([{ path: 'notes/s.md', raw: '# S\n\n## Setup\n\n```\n## not this\n```\n[x](gone.md)\n' }])
assert.deepEqual(sec.map(i => [i.line, i.heading]), [[8, 'Setup']])
assert.equal(lint([{ path: 'notes/t.md', raw: 'no heading' }])[0].heading, undefined)

// outdated-ref (R092): warn, target = old path, task + new path carried for the Fix docs prompt
const g = { path: 'docs/g.md', raw: '# G\n\n## Files\nSee `src/a.ts`.\n' }
const od = lintDocs([g], graphOf([g]), { outdated: [{ path: g.path, line: 4, taskId: 'T001', from: 'src/a.ts', to: 'src/b.ts' }, { path: g.path, line: 4, taskId: 'T002', from: 'src/x.ts' }] })
  .filter(i => i.rule === 'outdated-ref')
assert.deepEqual(od.map(i => `${i.line} ${i.level} ${i.message}`), ['4 warn `src/a.ts` was renamed to `src/b.ts` by T001', '4 warn `src/x.ts` was deleted by T002'])
assert.deepEqual([od[0].target, od[0].task, od[0].renamedTo, od[0].heading, od[1].renamedTo], ['src/a.ts', 'T001', 'src/b.ts', 'Files', undefined])

console.log('doc-lint: ok')
