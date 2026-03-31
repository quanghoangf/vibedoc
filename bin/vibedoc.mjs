#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import net from 'node:net'

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
const portIndex = args.indexOf('--port')
const port = portIndex !== -1 && args[portIndex + 1] ? args[portIndex + 1] : await findFreeRandomPort()

console.log('\n🚀 Starting VibeDoc...\n')

// Start Next.js server
const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npx.cmd' : 'npx'

const server = spawn(npmCmd, ['next', 'start', '-p', port], {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: isWindows
})

server.on('error', (err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})

// Wait for server to be ready, then open browser
await setTimeout(2500)

const url = `http://localhost:${port}/setup`

try {
  const open = (await import('open')).default
  await open(url)
  console.log(`\n✓ VibeDoc running at ${url}\n`)
  console.log('Press Ctrl+C to stop the server.\n')
} catch {
  console.log(`\n✓ VibeDoc running at ${url}`)
  console.log('Open this URL in your browser.\n')
  console.log('Press Ctrl+C to stop the server.\n')
}

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
