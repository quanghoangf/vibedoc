// node src/lib/first-screen.check.mts
import assert from 'node:assert/strict'
import { firstScreen, hasProjectDocs, lastPageCookie, lastPageTarget, welcomeKind } from './first-screen.ts'

assert.equal(hasProjectDocs([]), false)
assert.equal(hasProjectDocs(['LICENSE.md', 'CHANGELOG.md', 'CONTRIBUTING.md']), false)
assert.equal(hasProjectDocs(['plans/tasks/T001-x.md', 'memory/MEMORY.md', '.github/pull_request_template.md']), false)
assert.equal(hasProjectDocs(['node_modules/x/README.md']), false)
assert.equal(hasProjectDocs(['README.md']), true)
assert.equal(hasProjectDocs(['docs/prd.md']), true)
assert.equal(hasProjectDocs(['CLAUDE.md']), true)
assert.equal(hasProjectDocs(['docs/changelog-notes/plan.md']), true)

assert.equal(firstScreen({ tasks: 0, roadmapItems: 0 }), 'start')
assert.equal(firstScreen({ tasks: 1, roadmapItems: 0 }), 'board')
assert.equal(firstScreen({ tasks: 0, roadmapItems: 2 }), 'board')
assert.equal(firstScreen({ tasks: 0, roadmapItems: 0, demo: true }), 'board')

assert.equal(welcomeKind(['README.md']), 'docs')
assert.equal(welcomeKind(['LICENSE.md']), 'empty')
assert.equal(lastPageTarget('/roadmap'), '/roadmap')
assert.equal(lastPageTarget(undefined), '/board')
assert.equal(lastPageTarget(''), '/board')
assert.equal(lastPageTarget('/start'), '/board')
assert.equal(lastPageTarget('/setup'), '/board')
assert.equal(lastPageTarget('https://evil.example'), '/board')
assert.equal(lastPageTarget('//evil.example'), '/board')
assert.match(lastPageCookie('/roadmap') ?? '', /^vibedoc-last=\/roadmap; path=\//)
assert.match(lastPageCookie('/docs/some/doc') ?? '', /^vibedoc-last=\/docs;/)
assert.equal(lastPageCookie('/start'), null)
assert.equal(lastPageCookie('/setup'), null)
assert.equal(lastPageCookie('/'), null)
console.log('first-screen ok')
