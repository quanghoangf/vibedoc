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

/** Agent name from an MCP client's User-Agent ("claude-code/2.1" → "claude"); "agent" when unknown. */
export function agentFromUserAgent(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase()
  return KNOWN_AGENTS.find((a) => s.includes(a)) ?? "agent"
}
