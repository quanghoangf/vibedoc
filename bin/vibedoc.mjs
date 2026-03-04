#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Parse args
const args = process.argv.slice(2)
const portIndex = args.indexOf('--port')
const port = portIndex !== -1 && args[portIndex + 1] ? args[portIndex + 1] : '3000'

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
