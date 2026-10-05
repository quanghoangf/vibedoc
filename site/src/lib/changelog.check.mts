// node site/src/lib/changelog.check.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseChangelog, parseItem } from './changelog.ts'

const item = parseItem('* **evidence:** evidence API and vibedoc_get_evidence MCP tool (T154) ([099c654](https://github.com/x/y/commit/099c654))')
assert.deepEqual(item, { scope: 'evidence', text: 'Evidence API and vibedoc_get_evidence MCP tool', commit: 'https://github.com/x/y/commit/099c654' })
assert.equal(parseItem('* **mcp:** vibedoc_get_frontend tool ([abcdef1](u))').text, 'vibedoc_get_frontend tool')
assert.equal(parseItem('* fix the board ([abcdef1](u))').text, 'Fix the board')
assert.equal(parseItem('* **graph:** second critique (T108–T112) ([abcdef1](u))').text, 'Second critique')
assert.equal(parseItem('* **graph:** T109 resolve [@includes](https://github.com/includes) ([abcdef1](u))').text, 'Resolve @includes')
assert.equal(parseItem('* **cli:** keep (the) parens ([abcdef1](u))').text, 'Keep (the) parens')

const md = `# [1.14.0](https://c/v1.13.0...v1.14.0) (2026-10-05)


### Bug Fixes

* **ui:** a fix ([1111111](u1))

### Features

* **a:** one (T1) ([2222222](u2))
* two ([3333333](u3))

## [1.13.1](https://c/v1.13.0...v1.13.1) (2026-10-04)

### Performance Improvements

* faster ([4444444](u4))
`
const rs = parseChangelog(md)
assert.equal(rs.length, 2)
assert.deepEqual([rs[0].version, rs[0].date, rs[0].compare], ['1.14.0', '2026-10-05', 'https://c/v1.13.0...v1.14.0'])
assert.deepEqual(rs[0].groups.map((g) => [g.name, g.items.length]), [['New', 2], ['Fixed', 1]])
assert.deepEqual(rs[1].groups.map((g) => g.name), ['Improved'])

const real = parseChangelog(readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8'))
assert.ok(real.length >= 18, `releases: ${real.length}`)
assert.ok(real.every((r) => r.groups.length > 0 || r.version), 'every release parsed')
console.log(`changelog: ok (${real.length} releases)`)
