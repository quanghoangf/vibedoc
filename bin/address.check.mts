// Self-check for the project's stable address (R080). Run: node bin/address.check.mts
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { connectCommand, firstFreePort, isPortTaken, mcpUrl, parsePortArg, readSavedPort, savePort, startupBanner } from './address.mjs'

const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-address-'))
const servers: ReturnType<typeof createServer>[] = []
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
} finally {
  for (const s of servers) s.close()
  rmSync(root, { recursive: true, force: true })
}
console.log('address.check: ok')
