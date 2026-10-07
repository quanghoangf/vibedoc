// node src/lib/first-screen.check.mts
import assert from 'node:assert/strict'
import { firstScreen, hasProjectDocs, welcomeKind } from './first-screen.ts'

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
console.log('first-screen ok')
