// Self-check for the stable address (R080, R100). Run: node bin/address.check.mts
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { createServer as createHttpServer } from 'node:http'
import { addToHub, addressChangedMessage, connectCommand, firstFreePort, isPortTaken, mcpUrl, parsePortArg, portFile, probeVibedoc, readSavedPort, resolveAddress, savePort, startupBanner, tailLines, vibedocHome, waitUntilReady } from './address.mjs'

const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-address-'))
const servers: { close(): unknown }[] = []
const hold = (port: number, host?: string) => new Promise<void>((resolve) => {
  const s = createServer()
  servers.push(s)
  s.listen(port, host, () => resolve())
})
try {
  // Save / read round trip in the home folder (<home>/port, R100); missing or garbage file → null
  const home = path.join(root, 'home')
  assert.equal(readSavedPort(home), null)
  assert.equal(savePort(home, 4321), true)
  assert.equal(readSavedPort(home), 4321)
  assert.equal(portFile(home), path.join(home, 'port'))
  writeFileSync(portFile(home), 'not a port\n')
  assert.equal(readSavedPort(home), null)
  writeFileSync(portFile(home), '70000\n')
  assert.equal(readSavedPort(home), null)
  // A file where the home folder should be → can't save, no throw
  const blocked = path.join(root, 'blocked')
  writeFileSync(blocked, '')
  assert.equal(savePort(blocked, 4321), false)
  // home = $VIBEDOC_HOME, else ~/.vibedoc (same as core's hubFile)
  const prevHome = process.env.VIBEDOC_HOME
  process.env.VIBEDOC_HOME = home
  assert.equal(vibedocHome(), home)
  delete process.env.VIBEDOC_HOME
  assert.equal(vibedocHome(), path.join(homedir(), '.vibedoc'))
  if (prevHome !== undefined) process.env.VIBEDOC_HOME = prevHome

  // --port parsing
  assert.deepEqual(parsePortArg([]), { port: null })
  assert.deepEqual(parsePortArg(['--port', '4000']), { port: 4000 })
  assert.ok(parsePortArg(['--port', 'abc']).error)
  assert.ok(parsePortArg(['--port']).error)
  assert.ok(parsePortArg(['--port', '0']).error)
  assert.ok(parsePortArg(['--port', '4000.5']).error)

  // Taken ports: held on all interfaces and on 127.0.0.1 only; first free skips them
  const base = 3080 + 3100 // 6180–6182: away from the ports other sessions use
  assert.equal(await isPortTaken(base), false)
  await hold(base)
  await hold(base + 1, '127.0.0.1')
  assert.equal(await isPortTaken(base), true)
  assert.equal(await isPortTaken(base + 1), true)
  assert.equal(await firstFreePort(base), base + 2)

  // Banner: app URL, the project's MCP URL (?root=, encoded), the quoted connect command; same text on every run
  const banner = startupBanner({ root: '/p/my repo', port: 3333 })
  assert.match(banner, /App: +http:\/\/localhost:3333\n/)
  assert.equal(mcpUrl(3333, '/p/my repo'), 'http://localhost:3333/api/mcp?root=%2Fp%2Fmy%20repo')
  assert.ok(banner.includes('MCP:     http://localhost:3333/api/mcp?root=%2Fp%2Fmy%20repo'))
  assert.ok(banner.includes("claude mcp add --transport http vibedoc 'http://localhost:3333/api/mcp?root=%2Fp%2Fmy%20repo'"))
  assert.equal(banner, startupBanner({ root: '/p/my repo', port: 3333 }))
  assert.equal(connectCommand(3333), 'claude mcp add --transport http vibedoc http://localhost:3333/api/mcp')
  // Not in a repo: no project, no MCP line, says All projects
  const loose = startupBanner({ root: null, port: 3333 })
  assert.ok(loose.includes('All projects') && !loose.includes('/api/mcp'))

  // Probe: a VibeDoc answers /api/projects with its root first; HTML or a closed port is "another program"
  const serve = (port: number, body: string, type: string) => new Promise<void>((resolve) => {
    const s = createHttpServer((_, res) => { res.writeHead(200, { 'content-type': type }); res.end(body) })
    servers.push(s)
    s.listen(port, '127.0.0.1', () => resolve())
  })
  const vd = base + 10, html = base + 11, closed = base + 12
  await serve(vd, JSON.stringify([{ id: 'p', root }]), 'application/json')
  await serve(html, '<html>hi</html>', 'text/html')
  assert.deepEqual(await probeVibedoc(vd), { root })
  assert.equal(await probeVibedoc(html), null)
  assert.equal(await probeVibedoc(closed), null)
  // A hub with no projects yet (started outside a repo) still is a VibeDoc
  const emptyHub = base + 13
  await serve(emptyHub, '[]', 'application/json')
  assert.deepEqual(await probeVibedoc(emptyHub), { root: null })
  assert.deepEqual(await resolveAddress({ explicit: null, saved: emptyHub }), { running: emptyHub })

  // addToHub: POSTs {root} with the CLI header → {id}; an error reply or a closed port → {error}
  const hubPort = base + 14
  let seen: { header?: string; body?: string } = {}
  await new Promise<void>((resolve) => {
    const s = createHttpServer((req, res) => {
      let body = ''
      req.on('data', (d) => { body += d })
      req.on('end', () => {
        seen = { header: req.headers['x-vibedoc-cli'] as string, body }
        const ok = req.url === '/api/projects/add' && JSON.parse(body).root === root
        res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' })
        res.end(JSON.stringify(ok ? { id: 'p1', added: true } : { error: 'not a folder: x' }))
      })
    })
    servers.push(s)
    s.listen(hubPort, '127.0.0.1', () => resolve())
  })
  assert.deepEqual(await addToHub(hubPort, root), { id: 'p1' })
  assert.equal(seen.header, '1')
  assert.deepEqual(await addToHub(hubPort, '/nope'), { error: 'not a folder: x' })
  assert.ok((await addToHub(closed, root)).error)

  // Resolve: free saved port → start there; any VibeDoc hub → running (R100); another program → next free + changedFrom
  assert.deepEqual(await resolveAddress({ explicit: null, saved: closed }), { start: closed })
  assert.deepEqual(await resolveAddress({ explicit: null, saved: vd }), { running: vd })
  assert.deepEqual(await resolveAddress({ explicit: null, saved: html }), { start: closed, changedFrom: html })
  assert.match((await resolveAddress({ explicit: html, saved: null })).error ?? '', new RegExp(`Port ${html} is in use by another program`))
  assert.deepEqual(await resolveAddress({ explicit: vd, saved: null }), { running: vd })

  const changed = addressChangedMessage({ oldPort: 3333, newPort: 3334 })
  assert.ok(changed.includes('Port 3333'))
  assert.ok(changed.includes('http://localhost:3334/api/mcp'))
  assert.ok(changed.includes('claude mcp remove vibedoc'))
  assert.ok(changed.includes(connectCommand(3334)))
  const changedRoot = addressChangedMessage({ oldPort: 3333, newPort: 3334, root: '/p' })
  assert.ok(changedRoot.includes(mcpUrl(3334, '/p')) && changedRoot.includes(connectCommand(3334, '/p')))

  // Ready: an app that starts answering after ~500 ms; a child that dies first; nothing answering at all
  const sleeper = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'])
  const late = base + 20
  const child = sleeper()
  setTimeout(() => { serve(late, JSON.stringify([{ root }]), 'application/json') }, 500)
  assert.equal(await waitUntilReady({ port: late, child, intervalMs: 100 }), 'ready')
  child.kill()
  assert.deepEqual(await waitUntilReady({ port: base + 21, child: spawn(process.execPath, ['-e', 'process.exit(3)']) }), { exit: 3 })
  const idle = sleeper()
  assert.equal(await waitUntilReady({ port: base + 22, child: idle, timeoutMs: 600, intervalMs: 100 }), 'timeout')
  idle.kill()
  assert.deepEqual(tailLines('a\n\nb\nc\n', 2), ['b', 'c'])
} finally {
  for (const s of servers) s.close()
  rmSync(root, { recursive: true, force: true })
}
console.log('address.check: ok')
