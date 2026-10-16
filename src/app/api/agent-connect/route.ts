/**
 * /api/agent-connect (R081)
 * GET: the connection steps' evidence for the Connect panel (and R082 / R084): the newest MCP tool call.
 * The skills step is `claude plugin list --json` on every GET: a plugin installed inside Claude Code never calls
 * VibeDoc, so the panel polls.
 * POST { step: "mcp", url, replace? }: the user confirmed Connect, so run `claude mcp add` in the project
 * (replace: `claude mcp remove` first). { step: "mcp-all", url, replace? }: the same at user scope with the
 * `X-VibeDoc-Root: ${PWD}` header, one server for every hub project (R104, ADR-006). GET also lists every hub
 * project with its own evidence. POST { step: "skills" }: add the vibedoc marketplace (unless there) and
 * install the plugin. Answers with what the CLI said, so the panel can name what changed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, getAgentConnection, readHub } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'
import { hasVibedocMarketplace, mcpAlreadyExists, pluginInstalled, validMcpUrl, VIBEDOC_MARKETPLACE, VIBEDOC_PLUGIN } from '@/lib/agent-connect'
import { marketplaceAdd, marketplaceList, mcpAdd, mcpAddUser, mcpRemove, mcpRemoveUser, pluginInstall, pluginList, type CliResult } from '@/lib/claude-cli'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const [conn, plugins, projects] = await Promise.all([getAgentConnection(root), pluginList(root), projectConnections()])
  return NextResponse.json({
    projects,
    mcp: { connected: conn !== null, agent: conn?.agent ?? null, lastCall: conn?.lastCall ?? null },
    skills: {
      installed: pluginInstalled(plugins.data, root),
      missing: plugins.error?.missing === true,
      error: plugins.error && !plugins.error.missing ? (plugins.error.stderr.trim() || `claude exited with code ${plugins.error.code}`) : null,
    },
  })
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  // This POST runs commands on the user's machine: refuse cross-site requests. JSON content type forces a CORS preflight.
  const origin = req.headers.get('origin')
  let sameOrigin = req.headers.get('sec-fetch-site') !== 'cross-site'
  try { if (origin && new URL(origin).host !== req.nextUrl.host) sameOrigin = false } catch { sameOrigin = false }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  const body = await req.json().catch(() => null) as { step?: unknown; url?: unknown; replace?: unknown } | null
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  if (body?.step === 'skills') return NextResponse.json(await installSkills(root))
  // R104: 'mcp-all' = one user-scope server for every project (ADR-006), 'mcp' = this project only (local scope)
  const all = body?.step === 'mcp-all'
  if (body?.step !== 'mcp' && !all) return NextResponse.json({ error: 'Unknown step' }, { status: 400 })
  if (!validMcpUrl(body.url)) return NextResponse.json({ error: 'url must be an http(s) URL' }, { status: 400 })

  const outputs: CliResult[] = []
  if (body.replace === true) {
    const removed = await (all ? mcpRemoveUser(root) : mcpRemove(root))
    outputs.push(removed)
    if (!removed.ok) return NextResponse.json(answer(outputs))
  }
  outputs.push(await (all ? mcpAddUser(root, body.url) : mcpAdd(root, body.url)))
  const res = answer(outputs)
  if (res.ok) emitUpdate('agent_connect', { root, step: all ? 'mcp-all' : 'mcp' })
  return NextResponse.json(res)
}

/** R104: every hub project (archived left out) with its own evidence (.vibedoc/agent-connection.json). */
async function projectConnections() {
  const { projects } = await readHub()
  return Promise.all(projects.filter(p => !p.archived).map(async p => {
    const c = await getAgentConnection(p.root)
    return { id: p.id, name: p.name, root: p.root, connected: c !== null, agent: c?.agent ?? null, lastCall: c?.lastCall ?? null }
  }))
}

async function installSkills(root: string) {
  const outputs: CliResult[] = []
  const markets = await marketplaceList(root)
  if (markets.error) return answer([markets.error])
  if (!hasVibedocMarketplace(markets.data)) {
    const added = await marketplaceAdd(root, VIBEDOC_MARKETPLACE)
    outputs.push(added)
    if (!added.ok) return answer(outputs)
  }
  outputs.push(await pluginInstall(root, VIBEDOC_PLUGIN))
  const res = answer(outputs)
  if (res.ok) emitUpdate('agent_connect', { root, step: 'skills' })
  return res
}

/** The last command decides; `output` keeps every command's stdout (what changed) for the panel. */
function answer(outputs: CliResult[]) {
  const last = outputs[outputs.length - 1]
  return {
    ok: last.ok,
    missing: last.missing,
    exists: !last.ok && mcpAlreadyExists(last.stderr + last.stdout),
    output: outputs.map(o => o.stdout.trim()).filter(Boolean).join('\n'),
    error: last.ok ? null : (last.stderr.trim() || last.stdout.trim() || `claude exited with code ${last.code}`),
  }
}
