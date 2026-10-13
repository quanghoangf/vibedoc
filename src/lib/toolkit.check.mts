// node src/lib/toolkit.check.mts
import assert from 'node:assert/strict'
import { TOOLKIT_CATALOG } from './toolkit-catalog.ts'
import { installCommands, pluginId, rankToolkit, signalsFrom, TOOLKIT_SIGNALS } from './toolkit.ts'
import { pluginInstalled } from './agent-connect.ts'

// Catalog shape
const ids = TOOLKIT_CATALOG.map(i => i.id)
assert.equal(new Set(ids).size, ids.length, 'unique ids')
for (const i of TOOLKIT_CATALOG) {
  assert.ok(i.reason.en.trim() && i.reason.vi.trim(), `${i.id}: en + vi reason`)
  assert.ok(!i.reason.en.includes('\n') && !i.reason.vi.includes('\n'), `${i.id}: one line`)
  assert.match(i.marketplace.repo, /^[\w.-]+\/[\w.-]+$/, `${i.id}: marketplace repo is owner/name`)
  assert.match(i.marketplace.name, /^[\w.-]+$/, `${i.id}: marketplace name`)
  assert.match(i.plugin, /^[\w.-]+$/, `${i.id}: plugin name`)
  for (const s of i.fit) assert.ok((TOOLKIT_SIGNALS as readonly string[]).includes(s), `${i.id}: known signal ${s}`)
}
console.log('catalog ok')

// Signals
const none = { frontend: false, paths: [], deps: [] }
assert.equal(signalsFrom(none).size, 0)
assert.deepEqual([...signalsFrom({ frontend: true, paths: ['.git', 'tsconfig.json', 'src/app/api'], deps: [] })].sort(), ['git', 'lsp-ts', 'server', 'web-frontend'])
assert.ok(signalsFrom({ ...none, deps: ['hono'] }).has('server'))
assert.ok(signalsFrom({ ...none, paths: ['requirements.txt'] }).has('lsp-py'))
assert.ok(signalsFrom({ ...none, paths: ['go.mod'] }).has('lsp-go'))
console.log('signals ok')

// Ranking: this repo's shape (Next.js, TS, git, API routes)
const here = rankToolkit(TOOLKIT_CATALOG, signalsFrom({ frontend: true, paths: ['.git', 'tsconfig.json', 'src/app/api'], deps: ['next'] }))
const hereIds = here.map(i => i.id)
assert.deepEqual(hereIds.slice(0, 2), ['frontend-design', 'example-skills'])
assert.equal(here[0].matched, 'web-frontend')
assert.ok(hereIds.includes('typescript-lsp'))
assert.ok(!hereIds.includes('pyright-lsp') && !hereIds.includes('gopls-lsp'))
assert.deepEqual(hereIds.slice(-2), ['feature-dev', 'superpowers'])
assert.equal(here.at(-1)?.matched, undefined)

// A bare folder: only the always-fit items, nothing matched
const bare = rankToolkit(TOOLKIT_CATALOG, signalsFrom(none))
assert.deepEqual(bare.map(i => i.id), ['feature-dev', 'superpowers'])
assert.ok(bare.every(i => i.matched === undefined))
console.log('ranking ok')

// Commands + installed detection
const fd = TOOLKIT_CATALOG.find(i => i.id === 'frontend-design')!
assert.equal(pluginId(fd), 'frontend-design@claude-plugins-official')
assert.deepEqual(installCommands(fd), [
  'claude plugin marketplace add anthropics/claude-plugins-official',
  'claude plugin install frontend-design@claude-plugins-official',
])
const entry = { id: 'frontend-design@claude-plugins-official', scope: 'user', enabled: true }
assert.equal(pluginInstalled([entry], '/p', pluginId(fd)), true)
assert.equal(pluginInstalled([{ ...entry, enabled: false }], '/p', pluginId(fd)), false)
assert.equal(pluginInstalled([{ ...entry, scope: 'project', projectPath: '/other' }], '/p', pluginId(fd)), false)
assert.equal(pluginInstalled([{ ...entry, scope: 'project', projectPath: '/p' }], '/p', pluginId(fd)), true)
assert.equal(pluginInstalled([{ ...entry, id: 'frontend-design@fork' }], '/p', pluginId(fd)), false)
assert.equal(pluginInstalled([entry], '/p'), false, 'default still means vibedoc')
console.log('installed ok')

const { pickItems } = await import('./toolkit.ts')
assert.deepEqual(pickItems(TOOLKIT_CATALOG, ['superpowers', 'frontend-design'])?.map(i => i.id), ['frontend-design', 'superpowers'])
assert.equal(pickItems(TOOLKIT_CATALOG, ['superpowers', 'evil; rm -rf']), null)
assert.equal(pickItems(TOOLKIT_CATALOG, []), null)
assert.equal(pickItems(TOOLKIT_CATALOG, 'superpowers'), null)
assert.equal(pickItems(TOOLKIT_CATALOG, [1]), null)
console.log('pickItems ok')

const { formatToolkitResults } = await import('./toolkit.ts')
assert.equal(formatToolkitResults([{ id: 'a', ok: true }, { id: 'b', ok: false, stderr: 'boom\nmore' }, { id: 'c', ok: false }]),
  'Toolkit install results:\n- a: installed\n- b: failed — boom\n- c: failed')
assert.equal(formatToolkitResults([]), 'Toolkit: nothing was installed.')
console.log('formatToolkitResults ok')
