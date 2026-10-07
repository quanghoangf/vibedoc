// Self-check for the project's stable address (R080). Run: node bin/address.check.mts
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer as createHttpServer } from 'node:http'
import { addressChangedMessage, connectCommand, firstFreePort, isPortTaken, mcpUrl, parsePortArg, probeVibedoc, readSavedPort, resolveAddress, savePort, startupBanner, tailLines, waitUntilReady } from './address.mjs'

const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-address-'))
const servers: { close(): unknown }[] = []
const hold = (port: number, host?: string) => new Promise<void>((resolve) => {
  const s = createServer()
  servers.push(s)
  s.listen(port, host, () => resolve())
})
try {
  // Save / read round trip; missing or garbage file → null
  assert.equal(readSavedPort(root), null)
  assert.equal(savePort(root, 4321), true)
  assert.equal(readSavedPort(root), 4321)
  writeFileSync(path.join(root, '.vibedoc', 'port'), 'not a port\n')
  assert.equal(readSavedPort(root), null)
  writeFileSync(path.join(root, '.vibedoc', 'port'), '70000\n')
  assert.equal(readSavedPort(root), null)
  // A file where the folder should be → can't save, no throw
  const blocked = mkdtempSync(path.join(tmpdir(), 'vibedoc-address-ro-'))
  writeFileSync(path.join(blocked, '.vibedoc'), '')
  assert.equal(savePort(blocked, 4321), false)
  rmSync(blocked, { recursive: true, force: true })

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

  // Banner: app URL, MCP URL, connect command
  const banner = startupBanner({ root: '/p', port: 3333 })
  assert.match(banner, /App: +http:\/\/localhost:3333\n/)
  assert.ok(banner.includes(mcpUrl(3333)))
  assert.ok(banner.includes('claude mcp add --transport http vibedoc http://localhost:3333/api/mcp'))
  assert.equal(connectCommand(3333), 'claude mcp add --transport http vibedoc http://localhost:3333/api/mcp')

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

  // Resolve: free saved port → start there; this project's VibeDoc → running; another program → next free + changedFrom
  assert.deepEqual(await resolveAddress({ root, explicit: null, saved: closed }), { start: closed })
  assert.deepEqual(await resolveAddress({ root, explicit: null, saved: vd }), { running: vd })
  assert.deepEqual(await resolveAddress({ root: '/elsewhere', explicit: null, saved: vd }), { start: closed, changedFrom: vd })
  assert.deepEqual(await resolveAddress({ root, explicit: null, saved: html }), { start: closed, changedFrom: html })
  assert.match((await resolveAddress({ root, explicit: html, saved: null })).error ?? '', new RegExp(`Port ${html} is in use by another program`))
  assert.deepEqual(await resolveAddress({ root, explicit: vd, saved: null }), { running: vd })

  const changed = addressChangedMessage({ oldPort: 3333, newPort: 3334 })
  assert.ok(changed.includes('Port 3333'))
  assert.ok(changed.includes('http://localhost:3334/api/mcp'))
  assert.ok(changed.includes('claude mcp remove vibedoc'))
  assert.ok(changed.includes(connectCommand(3334)))

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
