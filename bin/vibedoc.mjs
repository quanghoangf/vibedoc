#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { appUrl, firstFreePort, parsePortArg, readSavedPort, savePort, startupBanner } from './address.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Parse args
const args = process.argv.slice(2)

// --version / -v: print VibeDoc's own version (relative to this file, not the cwd) and exit
if (args.some((a) => a === '--version' || a === '-v')) {
  const { version } = createRequire(import.meta.url)('../package.json')
  process.stdout.write(`${version}\n`)
  process.exit(0)
}

// Capture the user's cwd before spawning Next.js (which runs from projectRoot)
const VIBEDOC_ROOT = process.env.VIBEDOC_ROOT || process.cwd()

// The project's address (R080): --port N, else the saved port, else the first free one from 3333; saved for next time
const portArg = parsePortArg(args)
if (portArg.error) {
  console.error(`\n✗ ${portArg.error}\n`)
  process.exit(1)
}
const port = portArg.port ?? readSavedPort(VIBEDOC_ROOT) ?? (await firstFreePort())
if (!savePort(VIBEDOC_ROOT, port)) console.log(`   (Couldn't save the port to ${path.join(VIBEDOC_ROOT, '.vibedoc', 'port')}; the next run may use another one.)`)

console.log('\n🚀 Starting VibeDoc...\n')

// Start Next.js server
const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npx.cmd' : 'npx'

const server = spawn(npmCmd, ['next', 'start', '-p', String(port)], {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: isWindows,
  // VIBEDOC_PORT: the app's own port, for an in-app Connect panel (R081)
  env: { ...process.env, VIBEDOC_ROOT, VIBEDOC_PORT: String(port) }
})

server.on('error', (err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})

// Wait for server to be ready, then open browser
await setTimeout(2500)

const url = `${appUrl(port)}/setup`

console.log(`\n✓ VibeDoc is running\n\n${startupBanner({ root: VIBEDOC_ROOT, port })}\n`)
try {
  const open = (await import('open')).default
  await open(url)
} catch {
  console.log(`   Open ${url} in your browser.`)
}
console.log('   Press Ctrl+C to stop the server.\n')

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.kill('SIGTERM')
  process.exit(0)
})
