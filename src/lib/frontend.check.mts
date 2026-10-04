// Self-check: frontend app detection on fixture dirs. Run: node src/lib/frontend.check.mts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { applyOverride, cleanOverride, detectFrontendApp, detectFrontendProject, frontendNotes, packageScore, portFromScript, workspacePatterns } from './frontend.ts'

// Same reads as core.detectFrontend(): root package.json + which files sit next to it.
const fixture = (name: string) => {
  const dir = new URL(`./frontend-fixtures/${name}/`, import.meta.url)
  const pkg = new URL('package.json', dir)
  return detectFrontendApp('.', existsSync(pkg) ? readFileSync(pkg, 'utf8') : null, readdirSync(dir))
}

const next = fixture('next-app')
assert.deepEqual(next, {
  dir: '.', name: 'shop-web', framework: 'next', packageManager: 'npm',
  startCommand: 'npm run dev', url: 'http://localhost:3000', source: 'detected',
})

const vite = fixture('vite-app')
assert.equal(vite?.framework, 'vite')
assert.equal(vite?.packageManager, 'pnpm')
assert.equal(vite?.startCommand, 'pnpm run dev')
assert.equal(vite?.url, 'http://localhost:4000')

assert.equal(fixture('docs-only'), null)

// No web framework, or a broken package.json → null, never a throw.
assert.equal(detectFrontendApp('.', '{"name":"cli","dependencies":{"commander":"1"}}', []), null)
assert.equal(detectFrontendApp('.', '{not json', []), null)

// Framework precedence + default ports + start fallback.
const app = (deps: Record<string, string>, scripts: Record<string, string> = { dev: 'x' }, locks: string[] = []) =>
  detectFrontendApp('.', JSON.stringify({ name: 'a', dependencies: deps, scripts }), locks)
assert.equal(app({ '@remix-run/react': '2', vite: '5' })?.framework, 'remix')
assert.equal(app({ '@sveltejs/kit': '2', vite: '5' })?.url, 'http://localhost:5173')
assert.equal(app({ astro: '4', vite: '5' })?.url, 'http://localhost:4321')
assert.equal(app({ nuxt: '3' })?.framework, 'nuxt')
assert.equal(app({ 'react-scripts': '5' }, { start: 'react-scripts start' })?.startCommand, 'npm run start')
assert.equal(app({ next: '16' }, { dev: 'next dev -p 3005' }, ['yarn.lock'])?.startCommand, 'yarn run dev')
assert.equal(app({ next: '16' }, { dev: 'next dev -p 3005' })?.url, 'http://localhost:3005')
assert.equal(app({ vite: '5' }, {}, ['bun.lockb'])?.startCommand, 'bun run dev')

assert.equal(portFromScript('vite --port=4100'), 4100)
assert.equal(portFromScript('vite --host 0.0.0.0'), null)

// Notes: VibeDoc's own repo, port clash with VibeDoc.
assert.equal(frontendNotes(next!, 3000, false).length, 1)
assert.deepEqual(frontendNotes(vite!, 3000, false), [])
assert.equal(frontendNotes(vite!, 4000, true).length, 2)

// ─── Monorepos (T139): same reads as core.detectFrontend(), `dir/*` + literal globs ───
const read = (u: URL) => (existsSync(u) ? readFileSync(u, 'utf8') : null)
const monorepo = (name: string) => {
  const root = new URL(`./frontend-fixtures/${name}/`, import.meta.url)
  const pkg = read(new URL('package.json', root))
  const dirs = workspacePatterns(pkg, read(new URL('pnpm-workspace.yaml', root))).flatMap(p =>
    p.endsWith('/*') ? readdirSync(new URL(`${p.slice(0, -2)}/`, root)).map(d => `${p.slice(0, -2)}/${d}`) : [p])
  const packages = dirs.sort().flatMap(dir => {
    const json = read(new URL(`${dir}/package.json`, root))
    return json ? [{ dir, packageJson: json }] : []
  })
  return { pkg, files: readdirSync(root), packages }
}

const pnpmRepo = monorepo('pnpm-monorepo')
assert.deepEqual(workspacePatterns(pnpmRepo.pkg, readFileSync(new URL('./frontend-fixtures/pnpm-monorepo/pnpm-workspace.yaml', import.meta.url), 'utf8')), ['apps/*', 'packages/*'])
const web = detectFrontendProject(pnpmRepo.pkg, pnpmRepo.files, pnpmRepo.packages)
assert.equal(web?.dir, 'apps/web')
assert.equal(web?.startCommand, 'pnpm --filter web dev')
assert.equal(web?.url, 'http://localhost:3100')
assert.equal(web?.source, 'detected')
// Storybook-only packages/ui sinks below the docs site; both stay offered
assert.deepEqual(web?.candidates?.map(c => c.dir), ['apps/web', 'apps/docs', 'packages/ui'])
assert.ok(packageScore('packages/ui', '{"devDependencies":{"@storybook/react":"8"}}') < 0)

const npmRepo = monorepo('npm-workspaces')
const client = detectFrontendProject(npmRepo.pkg, npmRepo.files, npmRepo.packages)
assert.equal(client?.dir, 'packages/client')
assert.equal(client?.startCommand, 'npm run dev -w packages/client')
assert.deepEqual(client?.candidates, [{ dir: 'packages/client', name: '@shop/client', framework: 'vite' }])
assert.equal(detectFrontendProject('{"workspaces":["a"]}', ['yarn.lock'], [{ dir: 'a', packageJson: '{"name":"a","scripts":{"dev":"vite"},"dependencies":{"vite":"7"}}' }])?.startCommand, 'yarn workspace a dev')
// No framework in any package → the root package.json decides
assert.equal(detectFrontendProject(null, [], [{ dir: 'x', packageJson: '{"dependencies":{"express":"5"}}' }]), null)
assert.deepEqual(workspacePatterns('{"workspaces":["apps/*","!apps/legacy"]}', null), ['apps/*'])
assert.deepEqual(workspacePatterns('{not json', 'packages:\n  - libs/core\nother: 1\n  - nope\n'), ['libs/core'])

// ─── Override precedence ───
const detectAt = (dir: string) => detectFrontendProject(pnpmRepo.pkg, pnpmRepo.files, pnpmRepo.packages.filter(p => p.dir === dir))
assert.equal(applyOverride(web, null, detectAt), web)
const urlOnly = applyOverride(web, { url: 'http://localhost:9999' }, detectAt)
assert.equal(urlOnly?.url, 'http://localhost:9999')
assert.equal(urlOnly?.startCommand, 'pnpm --filter web dev', 'overriding only url keeps the detected start command')
assert.equal(urlOnly?.source, 'override')
const docs = applyOverride(web, { dir: 'apps/docs' }, detectAt)
assert.equal(docs?.startCommand, 'pnpm --filter docs dev')
assert.equal(docs?.url, 'http://localhost:4321')
assert.equal(docs?.candidates?.length, 3, 'switching app keeps every candidate')
assert.equal(applyOverride(web, { dir: 'apps/docs', startCommand: 'make docs' }, detectAt)?.startCommand, 'make docs')
const nothing = applyOverride(null, { startCommand: 'make web', url: 'http://localhost:8080' }, () => null)
assert.equal(nothing?.startCommand, 'make web')
assert.equal(nothing?.framework, 'unknown')
assert.deepEqual(frontendNotes(applyOverride(null, { startCommand: 'x' }, () => null)!, 3000, false), [], 'empty url never throws')
assert.deepEqual(cleanOverride({ dir: ' ', url: ' http://x:1 ', startCommand: 3 }), { url: 'http://x:1' })
assert.equal(cleanOverride({ dir: '' }), null)

console.log('frontend.check: ok')
