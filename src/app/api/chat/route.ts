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
import { getConfiguredRoot } from '@/lib/core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are the VibeDoc assistant, embedded in a docs/kanban web UI.
You can only act through the vibedoc_* MCP tools. To edit a doc: read it with vibedoc_read_doc,
then call vibedoc_propose_edit with only the spans that change (old_string → new_string), never the
whole file. The user reviews a diff and accepts or rejects it, so never claim an edit is applied until they say so.
For requests to plan a roadmap or break an epic into tasks, first call vibedoc_get_planning_guide and follow it.
Paths are relative to the project root. Keep replies short and answer in the user's language.`

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const { message, sessionId, docPath } = await req.json()
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
      const child = spawn('claude', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      let closed = false
      const send = (line: string) => { if (!closed) controller.enqueue(encoder.encode(line)) }
      const close = () => { if (!closed) { closed = true; controller.close() } }
      const fail = (message: string) => send(JSON.stringify({ type: 'error', message }) + '\n')

      child.stdout.on('data', (chunk: Buffer) => send(chunk.toString('utf8')))
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
      child.on('error', (e: NodeJS.ErrnoException) => {
        fail(e.code === 'ENOENT' ? 'Claude Code CLI not found on PATH. Install it and run `claude` once to log in.' : e.message)
        close()
      })
      child.on('close', (code) => {
        if (code !== 0 && code !== null) fail(stderr.trim() || `claude exited with code ${code}`)
        close()
      })
      req.signal.addEventListener('abort', () => { child.kill('SIGTERM'); close() })
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' },
  })
}
