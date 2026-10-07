"use client"

import Link from "next/link"
import { CheckCircle2, Plug } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"

/**
 * The welcome's agent row (R082). Seam for R081: its "Connect your agent" panel replaces this body; until then it says
 * whether an agent has called VibeDoc (any `ai` activity, like the header's Connect menu) or points at the guide.
 */
export function ConnectSlot() {
  const { activity } = useApp()
  const { t } = useT()
  const connected = activity.some((e) => e.actor === "ai")
  return connected ? (
    <p className="flex items-center gap-1.5 text-xs text-teal"><CheckCircle2 aria-hidden className="size-3.5" />{t("welcome.agentConnected")}</p>
  ) : (
    <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
      <Plug aria-hidden className="size-3.5" />{t("welcome.agentNotConnected")}
      <Link href="/getting-started" className="text-accent underline-offset-2 hover:underline">{t("welcome.connectHow")}</Link>
    </p>
  )
}
