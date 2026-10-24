"use client"

import Link from "next/link"
import { CheckCircle2, Plug } from "lucide-react"
import { CONNECT_HREF, useAgentConnected } from "@/components/shared/agent-connection"
import { useT } from "@/context/LanguageContext"

/**
 * The welcome's quiet terminal-agent row (R082), below the start: the start itself runs the in-app chat and needs no
 * MCP connection, so this is an option, never a prerequisite. Connected (any `ai` activity, like the header's chip),
 * or "your terminal agent can connect too" with the one link to Settings → Connect agent.
 */
export function ConnectSlot() {
  const { t } = useT()
  const connected = useAgentConnected()
  return connected ? (
    <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 aria-hidden className="size-3.5 text-teal" />{t("welcome.agentConnected")}</p>
  ) : (
    <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
      <Plug aria-hidden className="size-3.5" />{t("welcome.agentNotConnected")}
      <Link href={CONNECT_HREF} className="text-txt underline underline-offset-2 hover:text-accent">{t("welcome.connectHow")}</Link>
    </p>
  )
}
