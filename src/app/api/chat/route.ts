/**
 * /api/chat
 *
 * Chat with an agent from the UI, billed to the local Claude Code login (OpenClaw-style).
 * Spawns `claude -p` per turn and pipes its stream-json (NDJSON) output to the browser. The turn outlives the request:
 * a reloaded page re-attaches with GET /api/conversations/turn?id= (src/lib/chat-turns.ts).
 * Native tools are disabled: the agent can only use VibeDoc's own MCP tools, so every
 * write goes through core.ts and emits SSE updates like any other MCP client.
 */

import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { rootFrom, listEpisodes, listTasks, readActivity, writeEpisode } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { groupSessions } from '@/lib/sessions'
import { buildEpisode, isHandoffWritten, mergeSources, turnSessions } from '@/lib/episodes'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { CHAT_CALL_HEADER } from '@/lib/agent-connect'
import { beginTurn, isTurnRunning, turnStream } from '@/lib/chat-turns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are the VibeDoc assistant, embedded in a docs/kanban web UI.
You can only act through the vibedoc_* MCP tools. To edit a doc: read it with vibedoc_read_doc,
then call vibedoc_propose_edit with only the spans that change (old_string → new_string), never the
whole file. The user reviews a diff and accepts or rejects it, so never claim an edit is applied until they say so.
For requests to plan a roadmap or break an epic into tasks, first call vibedoc_get_planning_guide and follow it.
Paths are relative to the project root. Keep replies short and answer in the user's language.`

const EPISODE_LOOKBACK = 2000 // the whole activity log (ACTIVITY_CAP)

/** Last assistant text in a stream-json line, or null. */
function assistantText(line: string): string | null {
  try {
    const ev = JSON.parse(line)
    if (ev?.type !== 'assistant' || !Array.isArray(ev.message?.content)) return null
    const text = ev.message.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('').trim()
    return text || null
  } catch {
    return null
  }
}

/**
 * R050: each agent session this turn touched that has no MEMORY.md handoff gets `.vibedoc/episodes/<id>.md`.
 * The reply comes from the stream, not the saved chat: the browser saves the chat only after this stream ends.
 */
// ponytail: agent sessions are per root+actor (stampSession), so chats in one 30-min window share a session and its episode:
// Source lists every chat that wrote into it, the last turn to end writes its reply, and external `ai` agents still fold in.
// Upgrade path: stamp chat MCP calls with their own session id.
async function writeTurnEpisodes(root: string, since: string, conversationId: string | null, lastMessage: string | undefined) {
  const events = await readActivity(root, EPISODE_LOOKBACK)
  const sessions = turnSessions(groupSessions(events), events, since).filter(s => !isHandoffWritten(s, events))
  if (!sessions.length) return
  const { tasks } = await listTasks(root)
  const prev = await listEpisodes(root)
  const source = conversationId ? `chat ${conversationId}` : 'chat'
  for (const s of sessions) {
    const openTasks = s.tasks
      .filter(t => t.lastStatus !== 'done' && t.lastStatus !== 'cancelled')
      .map(t => ({ id: t.id, title: tasks.find(x => x.id === t.id)?.title ?? '', status: t.lastStatus }))
    const markdown = buildEpisode(s, { source: mergeSources(prev.find(e => e.sessionId === s.id)?.source, source), agent: 'claude-code', lastMessage, openTasks })
    if (!markdown) continue
    const file = await writeEpisode({ sessionId: s.id, markdown }, root)
    emitUpdate('episode_saved', { sessionId: s.id, file })
  }
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const { message, sessionId, docPath, conversationId } = await req.json()
  if (typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'message is required' }, { status: 400 })
  }

  // Doc context goes in the user turn, not the system prompt: resumed sessions reuse the first system prompt.
  const prompt = docPath ? `[Currently open doc: ${docPath}]\n\n${message}` : message
  const mcpUrl = `${req.nextUrl.origin}/api/mcp?root=${encodeURIComponent(root)}`

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    // R081: the header keeps this chat's tool calls from counting as "your agent is connected"
    '--mcp-config', JSON.stringify({ mcpServers: { vibedoc: { type: 'http', url: mcpUrl, headers: { [CHAT_CALL_HEADER]: '1' } } } }),
    '--strict-mcp-config',
    '--tools', '',
    '--allowedTools', 'mcp__vibedoc__*',
    // Content edits must go through vibedoc_propose_edit so the user reviews a diff first; -p can't prompt for deletes.
    // Roadmap items go through vibedoc_propose_plan for the same reason (the planning skill otherwise creates them directly).
    '--disallowedTools', 'mcp__vibedoc__vibedoc_write_doc', 'mcp__vibedoc__vibedoc_append_doc', 'mcp__vibedoc__vibedoc_delete_doc',
    'mcp__vibedoc__vibedoc_create_roadmap_item', 'mcp__vibedoc__vibedoc_delete_entry',
    '--setting-sources', '',
    '--disable-slash-commands',
    '--append-system-prompt', SYSTEM_PROMPT,
  ]
  if (typeof sessionId === 'string' && sessionId) args.push('--resume', sessionId)

  // Without an API key in env, the CLI falls back to the user's claude.ai login (subscription).
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY

  // The turn belongs to the server (chat-turns.ts): the browser's request only follows it, so a reload or a closed
  // tab no longer kills the agent. Stop is POST /api/conversations/turn/cancel.
  const id = typeof conversationId === 'string' && conversationId ? conversationId : `anon-${Date.now()}`
  if (isTurnRunning(root, id)) return Response.json({ error: 'This chat is already running a turn' }, { status: 409 })
  const since = new Date().toISOString()
  const child = spawn('claude', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const turn = beginTurn(root, id, child)
  let stderr = ''
  let pending = ''
  let lastMessage: string | undefined
  const fail = (message: string) => turn.push(JSON.stringify({ type: 'error', message }) + '\n')

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    turn.push(text)
    const lines = (pending + text).split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) lastMessage = assistantText(line) ?? lastMessage
  })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
  child.on('error', (e: NodeJS.ErrnoException) => {
    fail(e.code === 'ENOENT' ? 'Claude Code CLI not found on PATH. Install it and run `claude` once to log in.' : e.message)
    turn.end()
  })
  child.on('close', (code, signal) => {
    // Stop (cancelTurn): a page that replays this turn later shows it as stopped, unless the agent had said something
    if (signal === 'SIGTERM') { if (!(assistantText(pending) ?? lastMessage)) fail('Stopped.') }
    else if (code !== 0 && code !== null) fail(stderr.trim() || `claude exited with code ${code}`)
    turn.end()
    lastMessage = assistantText(pending) ?? lastMessage
    writeTurnEpisodes(root, since, typeof conversationId === 'string' ? conversationId : null, lastMessage)
      .catch(e => console.warn(`[vibedoc] episode not written: ${(e as Error).message}`))
  })

  const stream = turnStream(root, id, req.signal)!
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' },
  })
}
