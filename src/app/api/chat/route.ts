/**
 * /api/chat
 *
 * Chat with an agent from the UI, billed to the local Claude Code login (OpenClaw-style).
 * Spawns `claude -p` per turn and pipes its stream-json (NDJSON) output to the browser.
 * Native tools are disabled: the agent can only use VibeDoc's own MCP tools, so every
 * write goes through core.ts and emits SSE updates like any other MCP client.
 */

import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { getConfiguredRoot, listEpisodes, listTasks, readActivity, writeEpisode } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { groupSessions } from '@/lib/sessions'
import { buildEpisode, isHandoffWritten, mergeSources, turnSessions } from '@/lib/episodes'

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
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
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
    '--mcp-config', JSON.stringify({ mcpServers: { vibedoc: { type: 'http', url: mcpUrl } } }),
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const since = new Date().toISOString()
      const child = spawn('claude', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      let pending = ''
      let lastMessage: string | undefined
      let closed = false
      const send = (line: string) => { if (!closed) controller.enqueue(encoder.encode(line)) }
      const close = () => { if (!closed) { closed = true; controller.close() } }
      const fail = (message: string) => send(JSON.stringify({ type: 'error', message }) + '\n')

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        send(text)
        const lines = (pending + text).split('\n')
        pending = lines.pop() ?? ''
        for (const line of lines) lastMessage = assistantText(line) ?? lastMessage
      })
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
      child.on('error', (e: NodeJS.ErrnoException) => {
        fail(e.code === 'ENOENT' ? 'Claude Code CLI not found on PATH. Install it and run `claude` once to log in.' : e.message)
        close()
      })
      child.on('close', (code) => {
        if (code !== 0 && code !== null) fail(stderr.trim() || `claude exited with code ${code}`)
        close()
        lastMessage = assistantText(pending) ?? lastMessage
        writeTurnEpisodes(root, since, typeof conversationId === 'string' ? conversationId : null, lastMessage)
          .catch(e => console.warn(`[vibedoc] episode not written: ${(e as Error).message}`))
      })
      req.signal.addEventListener('abort', () => { child.kill('SIGTERM'); close() })
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' },
  })
}
