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

/** The root of the VibeDoc serving this port (its /api/projects lists the configured root first), or null for anything else. */
export async function probeVibedoc(port, timeoutMs = 1500) {
  try {
    const res = await fetch(`${appUrl(port)}/api/projects`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const projects = await res.json()
    return Array.isArray(projects) && typeof projects[0]?.root === 'string' ? { root: projects[0].root } : null
  } catch {
    return null
  }
}

/**
 * Where to serve the project: `{ start: port, changedFrom? }`, `{ running: port }` when this project's VibeDoc already
 * serves it, or `{ error }` when a pinned `--port` is held by another program.
 */
export async function resolveAddress({ root, explicit, saved }) {
  const wanted = explicit ?? saved
  if (wanted == null) return { start: await firstFreePort() }
  if (!(await isPortTaken(wanted))) return { start: wanted }
  const there = await probeVibedoc(wanted)
  if (there && path.resolve(there.root) === path.resolve(root)) return { running: wanted }
  if (explicit != null) return { error: `Port ${explicit} is in use by another program. Stop it, or run vibedoc without --port.` }
  return { start: await firstFreePort(wanted + 1), changedFrom: wanted }
}

/** Told when the usual port was taken: the new MCP URL and how to reconnect Claude Code. */
export function addressChangedMessage({ oldPort, newPort }) {
  return [
    `   ⚠ Port ${oldPort} (this project's usual address) is in use by another program.`,
    `     VibeDoc now runs on ${newPort}, so the MCP URL changed to ${mcpUrl(newPort)}`,
    '     Reconnect Claude Code:',
    '     claude mcp remove vibedoc',
    `     ${connectCommand(newPort)}`,
    `     Other agents: point their MCP config at the new URL. VibeDoc keeps ${newPort} from now on.`,
  ].join('\n')
}
