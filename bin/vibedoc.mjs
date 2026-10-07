#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { addressChangedMessage, appUrl, parsePortArg, readSavedPort, resolveAddress, savePort, startupBanner, tailLines, waitUntilReady } from './address.mjs'
import { prepareDemo, sweepDemos } from './demo.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')


async function openBrowser(url) {
  if (noOpen) return console.log(`   Open ${url} in your browser.`)
  try {
    const open = (await import('open')).default
    await open(url)
  } catch {
    console.log(`   Open ${url} in your browser.`)
  }
}

// Parse args
const args = process.argv.slice(2)
// `vibedoc check` (R090): the docs lint for CI from the prebuilt bundle; never starts the app
if (args[0] === 'check') {
  let run
  try {
    run = (await import('../dist/cli/check.mjs')).default
  } catch (e) {
    console.error(`✗ The docs check bundle is missing (${e.code ?? e.message}). In a VibeDoc checkout run: pnpm build:cli`)
    process.exit(2)
  }
  const code = await run(args.slice(1))
  // flush a large --json report through a pipe before exiting (the rest of this file would start the app)
  await new Promise((resolve) => process.stdout.write('', resolve))
  process.exit(code)
}

// --no-open / VIBEDOC_NO_OPEN=1: start without opening a browser tab (scripts, e2e)
const noOpen = args.includes('--no-open') || process.env.VIBEDOC_NO_OPEN === '1'

// --version / -v: print VibeDoc's own version (relative to this file, not the cwd) and exit
if (args.some((a) => a === '--version' || a === '-v')) {
  const { version } = createRequire(import.meta.url)('../package.json')
  process.stdout.write(`${version}\n`)
  process.exit(0)
}

// --demo (R085): the sample project in a throwaway temp copy, removed when this process ends
if (args.includes('--demo')) sweepDemos()
const demo = args.includes('--demo') ? prepareDemo() : null
if (demo) process.on('exit', demo.cleanup) // exit handlers run sync code only: cleanup uses rmSync
const demoEnv = demo ? { VIBEDOC_PLAYGROUND: '1', VIBEDOC_RUNS_DIR: demo.runsDir } : {}

// The page the browser opens on start: / redirects to the first screen that fits the project (R082); the demo opens its board
const START_PATH = demo ? '/board' : '/'

// Capture the user's cwd before spawning Next.js (which runs from projectRoot)
const VIBEDOC_ROOT = demo?.root || process.env.VIBEDOC_ROOT || process.cwd()

// The project's address (R080): --port N, else the saved port, else the first free one from 3333; saved for next time
const portArg = parsePortArg(args)
if (portArg.error) {
  console.error(`\n✗ ${portArg.error}\n`)
  process.exit(1)
}
const address = await resolveAddress({ root: VIBEDOC_ROOT, explicit: portArg.port, saved: readSavedPort(VIBEDOC_ROOT) })
if (address.error) {
  console.error(`\n✗ ${address.error}\n`)
  process.exit(1)
}
if (address.running) {
  // Already serving this project: don't start a second one on another port
  console.log(`\n✓ VibeDoc is already running for this project\n\n${startupBanner({ root: VIBEDOC_ROOT, port: address.running })}\n`)
  await openBrowser(`${appUrl(address.running)}${START_PATH}`)
  process.exit(0)
}
const port = address.start
if (!savePort(VIBEDOC_ROOT, port)) console.log(`   (Couldn't save the port to ${path.join(VIBEDOC_ROOT, '.vibedoc', 'port')}; the next run may use another one.)`)

console.log('\n🚀 Starting VibeDoc...\n')
if (demo) console.log(`   Demo: a sample project in a temporary copy (${VIBEDOC_ROOT}), deleted when you stop VibeDoc\n`)

// Start Next.js directly with this Node (no npx), so stopping VibeDoc stops the server too
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next')
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  stdio: ['inherit', 'inherit', 'pipe'],
  cwd: projectRoot,
  // VIBEDOC_PORT: the app's own port, for an in-app Connect panel (R081)
  env: { ...process.env, VIBEDOC_ROOT, VIBEDOC_PORT: String(port), ...demoEnv }
})

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

// Show the app's errors live, and keep the tail to explain a failed start
let stderr = ''
server.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
  stderr = (stderr + chunk).slice(-8000)
})

function failed(reason) {
  const tail = tailLines(stderr)
  console.error(`\n✗ VibeDoc could not start: ${reason}${tail.length ? `\n\n   Last output:\n${tail.map((l) => `   ${l}`).join('\n')}` : ''}\n`)
}

server.on('error', (err) => {
  failed(err.message)
  process.exit(1)
})

// Open the browser only once the app answers, never on a page that isn't up yet
const ready = await waitUntilReady({ port, child: server })
if (ready !== 'ready') {
  if (ready === 'timeout') {
    server.kill('SIGTERM')
    failed(`the app didn't answer on ${appUrl(port)} within 60 seconds`)
    process.exit(1)
  }
  failed(`the app exited with code ${ready.exit}`)
  process.exit(ready.exit || 1)
}
server.on('exit', (code) => process.exit(code ?? 0))

const url = `${appUrl(port)}${START_PATH}`

console.log(`\n✓ VibeDoc is ready\n\n${startupBanner({ root: VIBEDOC_ROOT, port })}\n`)
if (address.changedFrom) console.log(`${addressChangedMessage({ oldPort: address.changedFrom, newPort: port })}\n`)
await openBrowser(url)
console.log('   Press Ctrl+C to stop the server.\n')

