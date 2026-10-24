import type { Metadata } from "next"
import { TOOLS } from "@/lib/mcp-tools"
import { WelcomeBody } from "./WelcomeBody"

export const metadata: Metadata = {
  title: "VibeDoc — a home for your AI coding agent",
  description: "Kanban board, docs viewer and MCP server in one local process. Your agent moves tasks, you watch it live.",
}

/** Landing page (R042): outside the (app) group, so no sidebar or header. The tool count comes from the real list. */
export default function WelcomePage() {
  return <WelcomeBody toolCount={TOOLS.length} />
}
