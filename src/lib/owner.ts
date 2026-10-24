// Who is in charge of a task / epic (R055): `**Owner:** human` or `**Owner:** ai:<agent>`.
// Pure (no React, no fs). Self-check: `node src/lib/owner.check.mts`.

export type OwnerKind = "human" | "ai" | "none"

const KNOWN_AGENTS = ["claude", "cursor", "codex", "copilot", "gemini", "windsurf", "cline", "opencode"]

/** "human" | "ai:<agent>" (lowercase), or null for empty / "—" / anything else. A bare "ai" becomes "ai:agent". */
export function parseOwner(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "human") return "human"
  const m = v.match(/^ai(?::\s*([a-z0-9._-]+))?$/)
  return m ? `ai:${m[1] ?? "agent"}` : null
}

export function ownerKind(owner: string | null): OwnerKind {
  return owner === "human" ? "human" : owner?.startsWith("ai:") ? "ai" : "none"
}

/** "Human", "claude", "No owner". */
export function ownerLabel(owner: string | null): string {
  return owner === "human" ? "Human" : owner?.startsWith("ai:") ? owner.slice(3) : "No owner"
}

/** R108: a worker claims its task as `ai:worker-<chatId>`; that chat id, else null. */
export function workerChatId(owner: string | null): string | null {
  const m = owner?.match(/^ai:worker-(.+)$/)
  return m ? m[1] : null
}

/**
 * How a worker owner reads (never the raw id): the epic / task its chat ran, or `removed` when the chat is gone.
 * Null for any other owner. The UI words it ("Worker · R108", "Agent worker (removed)") and keeps the raw id in a title.
 */
export function workerOwner(
  owner: string | null,
  chats: readonly { id: string; worker?: { target?: { id: string } | null } | null }[],
): { chatId: string; target: string | null; removed: boolean } | null {
  const chatId = workerChatId(owner)
  if (!chatId) return null
  const chat = chats.find((c) => c.id === chatId)
  return { chatId, target: chat?.worker?.target?.id ?? null, removed: !chat }
}

/** Agent name from an MCP client's User-Agent ("claude-code/2.1" → "claude"); "agent" when unknown. */
export function agentFromUserAgent(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase()
  return KNOWN_AGENTS.find((a) => s.includes(a)) ?? "agent"
}
