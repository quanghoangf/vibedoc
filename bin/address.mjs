// The project's stable address (R080): the port lives in <project>/.vibedoc/port, so every run serves the same
// URL and an agent connected once stays connected. Plain JS: the bin ships unbuilt. Check: node bin/address.check.mts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'

export const FIRST_PORT = 3333

const portFile = (root) => path.join(root, '.vibedoc', 'port')

const validPort = (n) => Number.isInteger(n) && n >= 1 && n <= 65535

/** The saved port, or null when there is none (or it isn't a port). */
export function readSavedPort(root) {
  try {
    const n = Number(readFileSync(portFile(root), 'utf8').trim())
    return validPort(n) ? n : null
  } catch {
    return null
  }
}

/** Saves the port; returns false when it can't (e.g. a read-only repo), so the caller can say so. */
export function savePort(root, port) {
  try {
    mkdirSync(path.dirname(portFile(root)), { recursive: true })
    writeFileSync(portFile(root), `${port}\n`)
    return true
  } catch {
    return false
  }
}

/** `--port N` → { port }, no flag → { port: null }, bad value → { error }. */
export function parsePortArg(args) {
  const i = args.indexOf('--port')
  if (i === -1) return { port: null }
  const raw = args[i + 1]
  const n = Number(raw)
  return validPort(n) && /^\d+$/.test(raw) ? { port: n } : { error: `--port needs a number from 1 to 65535 (got ${raw ?? 'nothing'})` }
}

/** Taken = something answers on 127.0.0.1, or we can't listen on it (covers a holder on another interface). */
export async function isPortTaken(port) {
  const answers = await new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
  if (answers) return true
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => server.close(() => resolve(false)))
    server.listen(port)
  })
}

/** The first free port from `from` upward. */
export async function firstFreePort(from = FIRST_PORT) {
  for (let port = from; port <= 65535; port++) if (!(await isPortTaken(port))) return port
  throw new Error(`No free port from ${from} upward`)
}

export const appUrl = (port) => `http://localhost:${port}`
export const mcpUrl = (port) => `${appUrl(port)}/api/mcp`
export const connectCommand = (port) => `claude mcp add --transport http vibedoc ${mcpUrl(port)}`

/** What the terminal prints once VibeDoc serves the project. */
export function startupBanner({ root, port }) {
  return [
    `   Project: ${root}`,
    `   App:     ${appUrl(port)}`,
    `   MCP:     ${mcpUrl(port)}`,
    '',
    '   Connect Claude Code (once per project):',
    `   ${connectCommand(port)}`,
  ].join('\n')
}
