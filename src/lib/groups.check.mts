// Self-check for project groups. Run: node src/lib/groups.check.mts
import assert from 'node:assert/strict'
import { groupSlug, groupsOf, namesOf, slugsOf, withMembership } from './groups.ts'

// groupSlug
assert.equal(groupSlug('Shop'), 'shop')
assert.equal(groupSlug('  Shop App! '), 'shop-app')
assert.equal(groupSlug('!!!'), '')

// junk never throws
assert.deepEqual(slugsOf('shop'), [])
assert.deepEqual(slugsOf(['shop', 3, 'Bad Slug', 'shop', '', 'web-2']), ['shop', 'web-2'])
assert.deepEqual(namesOf(['x']), {})
assert.deepEqual(namesOf({ shop: 'Shop', x: 3, y: ' ' }), { shop: 'Shop' })

// groupsOf: matching slugs form a group; the newest settings file names it; a project can be in several
const p = (id: string, groups: unknown, groupNames: unknown, mtime: number) => ({ id, name: id.toUpperCase(), root: `/r/${id}`, groups, groupNames, mtime })
const gs = groupsOf([
  p('web', ['shop', 'admin'], { shop: 'Old shop', admin: 'Admin' }, 1),
  p('api', ['shop'], { shop: 'Shop' }, 5),
  p('mobile', ['shop'], {}, 9),
  p('cli', 'junk', null, 9),
])
assert.deepEqual(gs.map(g => [g.slug, g.name, g.members.map(m => m.id)]), [
  ['admin', 'Admin', ['web']],
  ['shop', 'Shop', ['web', 'api', 'mobile']],
])
assert.deepEqual(gs[0].members[0], { id: 'web', name: 'WEB', root: '/r/web' })
// no name anywhere → the slug; one member alone is still a group
assert.deepEqual(groupsOf([p('web', ['solo'], {}, 0)]).map(g => [g.name, g.members.length]), [['solo', 1]])

// withMembership keeps every other key, removes empty keys on leave
const s = { tasks: { sizeDays: { M: 3 } }, frontend: { dir: 'web' } }
const joined = withMembership(s, 'shop', true, 'Shop')
assert.deepEqual(joined, { ...s, groups: ['shop'], groupNames: { shop: 'Shop' } })
assert.deepEqual(withMembership(joined, 'shop', false), s)
assert.deepEqual(withMembership({ groups: ['a', 'shop'], groupNames: { a: 'A', shop: 'S' } }, 'shop', false), { groups: ['a'], groupNames: { a: 'A' } })
// rejoin with a new name renames; no name keeps none
assert.deepEqual(withMembership(joined, 'shop', true, 'Shop 2').groupNames, { shop: 'Shop 2' })
assert.deepEqual(withMembership({}, 'shop', true), { groups: ['shop'] })
assert.deepEqual(s, { tasks: { sizeDays: { M: 3 } }, frontend: { dir: 'web' } }, 'input not mutated')

console.log('groups.check: ok')
