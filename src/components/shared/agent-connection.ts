"use client"

import { useApp } from "@/context/AppContext"

/** The one place every "connect your agent" link goes (empty states, /start, First week, the header menu):
 *  Settings → Connect agent (R081). */
export const CONNECT_HREF = "/settings?tab=connect"

/** True once any agent has called VibeDoc (an `ai` event in the activity log, like the header Connect menu's
 *  "Last agent call"). Seam for R081: swap for its live connection status.
 *  ponytail: AppContext keeps the 30 newest events, so a busy human-only stretch can hide an old agent call;
 *  empty states only show on a fresh project, where that can't happen. */
export function useAgentConnected(): boolean {
  return useApp().activity.some((e) => e.actor === "ai")
}
