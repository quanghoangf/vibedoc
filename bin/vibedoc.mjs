#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import net from 'node:net'
import { createRequire } from 'node:module'
import { prepareDemo, sweepDemos } from './demo.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port)
  })
}

async function findFreeRandomPort() {
  for (let i = 0; i < 20; i++) {
    // Random port in ephemeral range 49152–65535 (avoids all common service ports)
    const candidate = Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152
    if (await isPortFree(candidate)) return candidate
  }
  throw new Error('Could not find a free port after 20 attempts')
}

// Parse args
const args = process.argv.slice(2)

// --version / -v: print VibeDoc's own version (relative to this file, not the cwd) and exit
if (args.some((a) => a === '--version' || a === '-v')) {
  const { version } = createRequire(import.meta.url)('../package.json')
  process.stdout.write(`${version}\n`)
  process.exit(0)
}

const portIndex = args.indexOf('--port')
const port = portIndex !== -1 && args[portIndex + 1] ? args[portIndex + 1] : await findFreeRandomPort()

// --demo (R085): the sample project in a throwaway temp copy, removed when this process ends
if (args.includes('--demo')) sweepDemos()
const demo = args.includes('--demo') ? prepareDemo() : null
if (demo) process.on('exit', demo.cleanup) // exit handlers run sync code only: cleanup uses rmSync
const demoEnv = demo ? { VIBEDOC_PLAYGROUND: '1', VIBEDOC_RUNS_DIR: demo.runsDir } : {}

// Capture the user's cwd before spawning Next.js (which runs from projectRoot)
const VIBEDOC_ROOT = demo?.root || process.env.VIBEDOC_ROOT || process.cwd()

console.log('\n🚀 Starting VibeDoc...\n')
console.log(demo ? `   Demo: a sample project in a temporary copy (${VIBEDOC_ROOT}), deleted when you stop VibeDoc` : `   Project root: ${VIBEDOC_ROOT}`)

// Start Next.js server
const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npx.cmd' : 'npx'

const server = spawn(npmCmd, ['next', 'start', '-p', port], {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: isWindows,
  // Own process group, so stop() reaches next-server too: npx doesn't pass a SIGTERM on, and next-server outlived us
  detached: !isWindows,
  env: { ...process.env, VIBEDOC_ROOT, ...demoEnv }
})

function stop() {
  try {
    if (isWindows) server.kill('SIGTERM')
    else process.kill(-server.pid, 'SIGTERM')
  } catch {} // already gone
}

// Handle graceful shutdown (before the ready wait: a Ctrl+C right away must still stop the server and remove the demo copy)
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stop()
  process.exit(0)
})

server.on('error', (err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
server.on('exit', (code) => process.exit(code ?? 0))

// Wait for server to be ready, then open browser
await setTimeout(2500)

const url = `http://localhost:${port}${demo ? '/board' : '/setup'}`

try {
  const open = (await import('open')).default
  if (!args.includes('--no-open')) await open(url)
  console.log(`\n✓ VibeDoc running at ${url}\n`)
  console.log('Press Ctrl+C to stop the server.\n')
} catch {
  console.log(`\n✓ VibeDoc running at ${url}`)
  console.log('Open this URL in your browser.\n')
  console.log('Press Ctrl+C to stop the server.\n')
}
