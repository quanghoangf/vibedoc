/**
 * Agent chat turns owned by the server, not by the browser request that started them: a reload (or a closed tab)
 * no longer kills the `claude -p` child. Each turn keeps every stream-json chunk it printed, so a page that loads
 * while it runs, or shortly after it ended, replays the whole turn and keeps following it.
 * Process handling only, no fs; state lives on globalThis (like test-runner.ts) so dev hot reloads keep it.
 */
import type { ChildProcess } from 'child_process'

type Listener = { onData: (chunk: string) => void; onEnd: () => void }
type Turn = { child: ChildProcess | null; chunks: string[]; running: boolean; startedAt: number; endedAt: number | null; listeners: Set<Listener> }

// ponytail: in memory, so a server restart (or a finished turn older than KEEP_MS) still loads as "interrupted";
// upgrade path: have the server write the reply into .vibedoc/chats/<id>.json itself.
const KEEP_MS = 30 * 60_000
const g = globalThis as unknown as { vibedocChatTurns?: Map<string, Turn>; vibedocChatTurnsExitHook?: boolean }
const turns = g.vibedocChatTurns ?? (g.vibedocChatTurns = new Map())

if (!g.vibedocChatTurnsExitHook) {
  g.vibedocChatTurnsExitHook = true
  process.once('exit', () => { for (const t of turns.values()) if (t.running) t.child?.kill('SIGTERM') })
}

const keyOf = (root: string, id: string) => `${root}\u0000${id}`

function sweep(now = Date.now()) {
  for (const [k, t] of turns) if (!t.running && t.endedAt !== null && now - t.endedAt > KEEP_MS) turns.delete(k)
}

/** True while a turn for this chat is still running (a second send is refused). */
export function isTurnRunning(root: string, id: string): boolean {
  return !!turns.get(keyOf(root, id))?.running
}

/** Registers a new turn; the caller spawns the child and feeds `push` / `end`. */
export function beginTurn(root: string, id: string, child: ChildProcess | null): { push: (chunk: string) => void; end: () => void } {
  sweep()
  const t: Turn = { child, chunks: [], running: true, startedAt: Date.now(), endedAt: null, listeners: new Set() }
  turns.set(keyOf(root, id), t)
  return {
    push: (chunk) => {
      t.chunks.push(chunk)
      for (const l of t.listeners) l.onData(chunk)
    },
    end: () => {
      if (!t.running) return
      t.running = false
      t.endedAt = Date.now()
      t.child = null
      for (const l of t.listeners) l.onEnd()
      t.listeners.clear()
    },
  }
}

/** Replays everything the turn printed so far, then follows it; returns null when there is no such turn. */
export function followTurn(root: string, id: string, l: Listener): (() => void) | null {
  sweep()
  const t = turns.get(keyOf(root, id))
  if (!t) return null
  for (const c of t.chunks) l.onData(c)
  if (!t.running) { l.onEnd(); return () => {} }
  t.listeners.add(l)
  return () => { t.listeners.delete(l) }
}

/** Stop: kills the child (its close handler ends the turn). False when nothing runs for this chat. */
export function cancelTurn(root: string, id: string): boolean {
  const t = turns.get(keyOf(root, id))
  if (!t?.running || !t.child) return false
  t.child.kill('SIGTERM')
  return true
}

/** This project's turns a page can still attach to: running, or ended within KEEP_MS. */
export function listTurns(root: string): { id: string; running: boolean; startedAt: string; endedAt: string | null }[] {
  sweep()
  const prefix = `${root}\u0000`
  return [...turns].filter(([k]) => k.startsWith(prefix)).map(([k, t]) => ({
    id: k.slice(prefix.length),
    running: t.running,
    startedAt: new Date(t.startedAt).toISOString(),
    endedAt: t.endedAt === null ? null : new Date(t.endedAt).toISOString(),
  }))
}

/** A ReadableStream of one turn (replay + live) for a Response; null when there is no such turn. */
export function turnStream(root: string, id: string, signal: AbortSignal): ReadableStream<Uint8Array> | null {
  if (!turns.has(keyOf(root, id))) return null
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      let closed = false
      const close = () => { if (!closed) { closed = true; controller.close() } }
      const stop = followTurn(root, id, {
        onData: (c) => { if (!closed) controller.enqueue(encoder.encode(c)) },
        onEnd: close,
      })
      // the browser went away (reload, tab closed): stop following, the turn itself keeps running
      signal.addEventListener('abort', () => { stop?.(); close() })
    },
  })
}
