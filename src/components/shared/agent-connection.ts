"use client"

import { useApp } from "@/context/AppContext"

/** The one place every "connect your agent" link goes (empty states, /start, First week, the header menu):
 *  Settings → Connect agent (R081). */
export const CONNECT_HREF = "/settings?tab=connect"

/**
 * The one "is an agent connected?" for the header, the Connect panel, First week and empty states: R081's evidence
 * file (`/api/summary` → `agentConnection`, the newest MCP tool call from the user's agent). `undefined` = not known
 * yet (the summary is loading): show neither "Connect" nor "connected". The read-only demo counts as connected, so
 * it never asks to connect.
 */
export function useAgentConnection(): { agent: string; lastCall: string } | null | undefined {
  const { summary, demo } = useApp()
  if (!summary) return undefined
  if (demo) return summary.agentConnection ?? { agent: "agent", lastCall: "" }
  return summary.agentConnection ?? null
}

/** true / false once known, null while the summary loads (render no connect hint then). */
export function useAgentConnected(): boolean | null {
  const c = useAgentConnection()
  return c === undefined ? null : c !== null
}
