"use client"

import { useApp } from "@/context/AppContext"

/** Where an empty state sends a user whose agent isn't connected: the guide's "Connect your agent" section.
 *  Seam for R081 (Connect your agent): point this at its Connect panel. */
export const CONNECT_HREF = "/getting-started#3-connect-your-agent"

/** True once any agent has called VibeDoc (an `ai` event in the activity log, like the header Connect menu's
 *  "Last agent call"). Seam for R081: swap for its live connection status.
 *  ponytail: AppContext keeps the 30 newest events, so a busy human-only stretch can hide an old agent call;
 *  empty states only show on a fresh project, where that can't happen. */
export function useAgentConnected(): boolean {
  return useApp().activity.some((e) => e.actor === "ai")
}
