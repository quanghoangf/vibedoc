"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import { CONNECT_HREF, useAgentConnected } from "./agent-connection"

interface EmptyStateProps {
  /** An emoji, or an icon element (`<ListTodo className="size-6" />`). */
  icon: ReactNode
  message: string
  subMessage?: string
  /** R083: what appears on this page and why it matters, in one sentence. */
  lead?: ReactNode
  /** R083: the one primary action (a button, a link, a CopyCommand). */
  action?: ReactNode
  /** The action needs the agent: until one has called VibeDoc, add a line linking to Connect. */
  needsAgent?: boolean
  bordered?: boolean
}

/** An empty page that teaches: what fills it, and the one action that does (R083). Carries `data-empty-state`. */
export function EmptyState({ icon, message, subMessage, lead, action, needsAgent, bordered }: EmptyStateProps) {
  const connected = useAgentConnected()
  const { t } = useT()
  return (
    <div
      data-empty-state
      className={cn(
        "flex flex-col items-center text-center py-16 px-4 text-muted text-sm",
        bordered && "border border-dashed border-border rounded-xl",
      )}
    >
      {typeof icon === "string" ? <p className="text-3xl mb-3">{icon}</p> : <div aria-hidden className="mb-3 text-muted">{icon}</div>}
      <p className={cn(lead && "text-base font-medium text-txt")}>{message}</p>
      {subMessage && <p className="text-xs mt-1">{subMessage}</p>}
      {lead && <p className="mt-2 max-w-md text-balance leading-relaxed">{lead}</p>}
      {action && <div data-empty-action className="mt-5 flex max-w-full justify-center">{action}</div>}
      {needsAgent && !connected && (
        <p data-connect-hint className="mt-4 text-xs">
          {t("shell.agentNotConnected")}{" "}
          <Link href={CONNECT_HREF} className="text-accent underline-offset-2 hover:underline">{t("shell.connectYourAgent")}</Link>
        </p>
      )}
    </div>
  )
}
