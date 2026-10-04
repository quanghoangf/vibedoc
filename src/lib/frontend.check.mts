// Self-check: frontend app detection on fixture dirs. Run: node src/lib/frontend.check.mts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { detectFrontendApp, frontendNotes, portFromScript } from './frontend.ts'

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

console.log('frontend.check: ok')
