"use client"

import { Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useChats, useItemAgent } from "@/context/ChatContext"
import { useT } from "@/context/LanguageContext"
import type { Attach } from "@/lib/chats"
import { useChatText } from "./chat-text"
import { StatusMarker } from "./StatusMarker"

/**
 * Pill on an epic/task while a chat works on it; click opens that chat.
 * `nodrag` + stopPropagation keep a React Flow node from dragging/selecting on click.
 */
export function AgentMark({ attach, className }: { attach: Attach; className?: string }) {
  const agent = useItemAgent(attach)
  const { show } = useChats()
  const { t } = useT()
  const text = useChatText()
  if (!agent) return null
  const label = text.agent(agent.status)
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); show(agent.chatId) }}
      title={t("chat.agentMarkTitle", { label })}
      aria-label={t("chat.agentMarkLabel", { label })}
      className={cn(
        "nodrag inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10px] leading-4 animate-fade-in transition-colors duration-(--duration-fast)",
        agent.status === "running" && "border-accent/50 text-accent hover:bg-accent/10",
        agent.status === "needs-answer" && "border-amber/50 text-amber hover:bg-amber/10",
        agent.status === "review" && "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20",
        className,
      )}
    >
      {agent.status === "running" ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Bot className="size-3" aria-hidden />}
      {label}
    </button>
  )
}

/** Non-interactive variant for places that are already a button (timeline markers, board cards, task rows). */
export function AgentDot({ attach }: { attach: Attach }) {
  const agent = useItemAgent(attach)
  const text = useChatText()
  if (!agent) return null
  return <StatusMarker status={agent.status} label={text.agent(agent.status)} />
}
