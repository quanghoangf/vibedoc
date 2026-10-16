// Self-check for the projects hub. Run: node src/lib/hub.check.mts
import assert from 'node:assert/strict'
import { addProject, restoreProject, switcherOrder, allocateId, emptyHub, normalizeRoot, orderProjects, parseHub, patchProject, projectFor, removeProject } from './hub.ts'

// normalizeRoot / allocateId
assert.equal(normalizeRoot('/a/b/'), '/a/b')
assert.equal(normalizeRoot('/'), '/')
assert.equal(allocateId('/x/web', []), 'web')
assert.equal(allocateId('/y/web', ['web']), 'web-2')
assert.equal(allocateId('/y/web', ['web', 'web-2']), 'web-3')
assert.equal(allocateId('/x/My App!', []), 'my-app')
assert.equal(allocateId('/x/...', []), 'project')

// parseHub: junk never throws, bad rows dropped, duplicate roots/ids fixed
assert.deepEqual(parseHub('not json'), emptyHub())
assert.deepEqual(parseHub(null), emptyHub())
assert.deepEqual(parseHub('{"projects": 3}'), emptyHub())
const parsed = parseHub(JSON.stringify({ version: 1, projects: [
  { id: 'a', root: '/r/a/', name: 'A', pinned: true },
  { id: 'a', root: '/r/b' },
  { root: '/r/a' },
  { root: 'relative' },
  null,
] }))
assert.deepEqual(parsed.projects.map(p => [p.id, p.root, p.name, p.pinned, p.archived, p.lastOpened]), [
  ['a', '/r/a', 'A', true, false, null],
  ['b', '/r/b', 'b', false, false, null],
])

// addProject: dedupes by root, allocates id
let hub = emptyHub()
let r = addProject(hub, '/w/web', '2026-10-16T00:00:00Z')
assert.equal(r.added, true)
assert.equal(r.project.id, 'web')
assert.equal(r.project.lastOpened, '2026-10-16T00:00:00Z')
hub = r.hub
r = addProject(hub, '/w/web/')
assert.equal(r.added, false)
assert.equal(r.hub, hub)
hub = addProject(hub, '/other/web').hub
assert.deepEqual(hub.projects.map(p => p.id), ['web', 'web-2'])

// projectFor: id or root
assert.equal(projectFor(hub, 'web-2')?.root, '/other/web')
assert.equal(projectFor(hub, '/w/web/')?.id, 'web')
assert.equal(projectFor(hub, 'nope'), null)

// patchProject: fields change, id stays, blank name ignored, unknown → null
const patched = patchProject(hub, 'web', { name: 'Website', pinned: true, root: '/moved/web/' })
assert.ok(patched)
assert.deepEqual(projectFor(patched, 'web'), { id: 'web', root: '/moved/web', name: 'Website', pinned: true, archived: false, lastOpened: '2026-10-16T00:00:00Z' })
assert.equal(patchProject(patched, 'web', { name: '  ' })?.projects[0].name, 'Website')
assert.equal(patchProject(hub, 'nope', { pinned: true }), null)

// removeProject
const rem = removeProject(hub, 'web')
assert.equal(rem.removed?.root, '/w/web')
assert.deepEqual(rem.hub.projects.map(p => p.id), ['web-2'])
assert.equal(removeProject(hub, 'nope').hub, hub)

// restoreProject: the same entry back; refused when its id or root is taken, or the entry is junk
const back = restoreProject(rem.hub, rem.removed)
assert.deepEqual(back?.projects.map(p => p.id), ['web-2', 'web'])
assert.equal(back?.projects[1].lastOpened, '2026-10-16T00:00:00Z')
assert.equal(restoreProject(hub, rem.removed), null)
assert.equal(restoreProject(rem.hub, { ...rem.removed, id: 'web-2' }), null)
assert.equal(restoreProject(rem.hub, { root: 'nope' }), null)
assert.equal(restoreProject(rem.hub, { root: '/z/x' }), null)

// orderProjects: configured first, archived last, else stable
const list = [
  { root: '/a', archived: true },
  { root: '/b', archived: false },
  { root: '/c', archived: false },
  { root: '/d', archived: false },
]
assert.deepEqual(orderProjects(list, '/c/').map(p => p.root), ['/c', '/b', '/d', '/a'])

// switcherOrder: archived hidden, pinned first, then newest lastOpened, then hub order
const sw = [
  { id: 'a', pinned: false, archived: false, lastOpened: '2026-10-01T00:00:00Z' },
  { id: 'b', pinned: false, archived: true, lastOpened: '2026-10-09T00:00:00Z' },
  { id: 'c', pinned: true, archived: false, lastOpened: null },
  { id: 'd', pinned: false, archived: false, lastOpened: '2026-10-05T00:00:00Z' },
  { id: 'e', pinned: false, archived: false, lastOpened: null },
  { id: 'f', pinned: false, archived: false, lastOpened: null },
]
assert.deepEqual(switcherOrder(sw).map(p => p.id), ['c', 'd', 'a', 'e', 'f'])

console.log('hub.check: ok')
