#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { addToHub, addressChangedMessage, appUrl, dropLegacyPort, legacyPort, migrationMessage, parsePortArg, portFile, readSavedPort, resolveAddress, savePort, startupBanner, tailLines, vibedocHome, waitUntilReady } from './address.mjs'
import { repoRoot } from './repo-root.mjs'
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

// R100: a repo that ran its own VibeDoc (R080's .vibedoc/port) is told once that the address moved, then the file goes
function noticeMigration(port) {
  if (!PROJECT || demo) return
  const oldPort = legacyPort(PROJECT)
  if (oldPort == null) return
  console.log(`${migrationMessage({ oldPort, port, root: PROJECT })}\n`)
  dropLegacyPort(PROJECT)
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

// The project (R100): VIBEDOC_ROOT when set, else the repo the user's cwd is in (captured before spawning Next.js,
// which runs from projectRoot); null = not in a repo, so the browser opens All projects
const PROJECT = demo?.root || (process.env.VIBEDOC_ROOT && path.resolve(process.env.VIBEDOC_ROOT)) || repoRoot(process.cwd())
// The server's configured (default) project; outside a repo the cwd, which the hub doesn't add (VIBEDOC_ADD_ROOT '')
const VIBEDOC_ROOT = PROJECT || process.cwd()

// The page the browser opens on start: /?root= maps the project to its hub id and the first screen that fits it
// (R082, R100); outside a repo All projects; the demo opens its board
const START_PATH = demo ? '/board' : PROJECT ? `/?root=${encodeURIComponent(PROJECT)}` : '/projects'

// The hub's address (R080, R100): --port N, else the port saved in the VibeDoc home, else the first free one from
// 3333; saved for next time. The demo never reads or saves it (its copy is throwaway)
const HOME = vibedocHome()
const portArg = parsePortArg(args)
if (portArg.error) {
  console.error(`\n✗ ${portArg.error}\n`)
  process.exit(1)
}
const address = await resolveAddress({ explicit: portArg.port, saved: demo ? null : readSavedPort(HOME) })
if (address.error) {
  console.error(`\n✗ ${address.error}\n`)
  process.exit(1)
}
if (address.running && demo) {
  // the demo's temp copy never joins the user's hub
  console.error(`\n✗ VibeDoc already runs on port ${address.running}. Run the demo without --port.\n`)
  process.exit(1)
}
if (address.running) {
  // A hub already runs (R100): add this repo to it and open it there, never a second server
  let openPath = START_PATH
  if (PROJECT) {
    const added = await addToHub(address.running, PROJECT)
    if (added.error) {
      console.error(`\n✗ VibeDoc runs on ${appUrl(address.running)} but couldn't add ${PROJECT}: ${added.error}\n`)
      process.exit(1)
    }
    openPath = `/?project=${encodeURIComponent(added.id)}`
  }
  console.log(`\n✓ VibeDoc is already running\n\n${startupBanner({ root: PROJECT, port: address.running })}\n`)
  noticeMigration(address.running)
  await openBrowser(`${appUrl(address.running)}${openPath}`)
  process.exit(0)
}
const port = address.start
if (!demo && !savePort(HOME, port)) console.log(`   (Couldn't save the port to ${portFile(HOME)}; the next run may use another one.)`)

console.log('\n🚀 Starting VibeDoc...\n')
if (demo) console.log(`   Demo: a sample project in a temporary copy (${VIBEDOC_ROOT}), deleted when you stop VibeDoc\n`)

// Start Next.js directly with this Node (no npx), so stopping VibeDoc stops the server too
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next')
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  stdio: ['inherit', 'inherit', 'pipe'],
  cwd: projectRoot,
  // VIBEDOC_PORT: the app's own port, for an in-app Connect panel (R081)
  // VIBEDOC_ADD_ROOT: the repo the hub adds on its first read (R100); '' outside a repo, so the cwd isn't added
  env: { ...process.env, VIBEDOC_ROOT, VIBEDOC_ADD_ROOT: PROJECT || '', VIBEDOC_PORT: String(port), ...demoEnv }
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

console.log(`\n✓ VibeDoc is ready\n\n${startupBanner({ root: PROJECT, port })}\n`)
if (address.changedFrom) console.log(`${addressChangedMessage({ oldPort: address.changedFrom, newPort: port, root: PROJECT })}\n`)
noticeMigration(port)
await openBrowser(url)
console.log('   Press Ctrl+C to stop the server.\n')

