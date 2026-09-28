// Self-check for fuzzy. Run: node src/lib/fuzzy.check.mts
import assert from 'node:assert/strict'
import { fuzzyFilter, fuzzyScore } from './fuzzy.ts'

assert.equal(fuzzyScore('', 'a.md'), 0)
assert.equal(fuzzyScore('xyz', 'docs/readme.md'), null)
assert.equal(fuzzyScore('dmr', 'docs/readme.md'), null, 'order matters: r comes before m')
assert.notEqual(fuzzyScore('hld', 'docs/architecture/02-high-level-design/HLD.md'), null)

const paths = [
  'docs/architecture/01-overview/DOMAIN_MAP.md',
  'docs/architecture/02-high-level-design/HLD.md',
  'README.md',
  'plans/roadmap/R001-now.md',
  'plans/tasks/T016-header-polish.md',
]
const top = (q: string) => fuzzyFilter(q, paths, (p) => p)[0]
assert.equal(top('hld'), 'docs/architecture/02-high-level-design/HLD.md')
assert.equal(top('domain'), 'docs/architecture/01-overview/DOMAIN_MAP.md')
assert.equal(top('readme'), 'README.md')
assert.equal(top('road'), 'plans/roadmap/R001-now.md')
assert.equal(fuzzyFilter('dm', paths, (p) => p).length >= 1, true)
assert.deepEqual(fuzzyFilter('', paths, (p) => p).length, paths.length)

console.log('fuzzy ok')
