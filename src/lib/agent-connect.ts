// Agent connection evidence (R081): the newest MCP tool call per project, read from .vibedoc/agent-connection.json.
// Pure: no fs, no React. Only `tools/call` counts as evidence; initialize / tools/list are health checks.

export interface AgentConnection {
  /** "claude", "cursor", … or "agent" when the client didn't say */
  agent: string
  /** ISO-8601 Z of the newest recorded tool call */
  lastCall: string
}

/** A recorded call is rewritten at most this often for the same agent. */
export const RECORD_EVERY_MS = 60_000

/** null for a missing, unreadable or malformed file. */
export function parseConnection(raw: string | null | undefined): AgentConnection | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<AgentConnection>
    if (typeof d?.agent !== 'string' || !d.agent || typeof d.lastCall !== 'string' || Number.isNaN(Date.parse(d.lastCall))) return null
    return { agent: d.agent, lastCall: d.lastCall }
  } catch {
    return null
  }
}

/** Write when nothing is recorded, the agent changed, or the record is older than RECORD_EVERY_MS. */
export function shouldRecordCall(prev: AgentConnection | null, agent: string, nowMs: number): boolean {
  if (!prev || prev.agent !== agent) return true
  return nowMs - Date.parse(prev.lastCall) >= RECORD_EVERY_MS
}

/** The command that adds VibeDoc to Claude Code's MCP servers (local scope: run it in the project folder). */
export function claudeMcpAddCommand(url: string): string {
  return `claude mcp add --transport http vibedoc ${url}`
}

/** Removes the project's (local scope) vibedoc server; the Replace flow runs it before the add. */
export function claudeMcpRemoveCommand(): string {
  return 'claude mcp remove vibedoc -s local'
}

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude Code', cursor: 'Cursor', codex: 'Codex', copilot: 'Copilot', gemini: 'Gemini',
  windsurf: 'Windsurf', cline: 'Cline', opencode: 'opencode',
}

/** Display name of a recorded agent; null when the client didn't say who it is ("agent"). */
export function agentLabel(agent: string | null | undefined): string | null {
  if (!agent || agent === 'agent') return null
  return AGENT_NAMES[agent] ?? agent
}

/** The MCP URL the Connect step may pass to `claude mcp add`: http(s) only, nothing a shell or CLI could misread. */
export function validMcpUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2000 || /\s/.test(url) || url.startsWith('-')) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** `claude mcp add` refused because a server named vibedoc is already configured for this project. */
export function mcpAlreadyExists(output: string): boolean {
  return /already exists/i.test(output)
}
