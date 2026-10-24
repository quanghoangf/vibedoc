"use client"

import Link from "next/link"
import { CheckCircle2, Plug } from "lucide-react"
import { CONNECT_HREF, useAgentConnected } from "@/components/shared/agent-connection"
import { useT } from "@/context/LanguageContext"

/**
 * The welcome's agent status line (R082), right under the one start: connected (any `ai` activity, like the header's
 * Connect chip), or "first, connect" with the one link to Settings → Connect agent.
 */
export function ConnectSlot() {
  const { t } = useT()
  const connected = useAgentConnected()
  return connected ? (
    <p className="flex items-center gap-1.5 text-xs text-teal"><CheckCircle2 aria-hidden className="size-3.5" />{t("welcome.agentConnected")}</p>
  ) : (
    <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
      <Plug aria-hidden className="size-3.5" />{t("welcome.agentNotConnected")}
      <Link href={CONNECT_HREF} className="text-accent underline-offset-2 hover:underline">{t("welcome.connectHow")}</Link>
    </p>
  )
}
