"use client"

import { useSyncExternalStore } from "react"
import { Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { openAgentChat } from "@/lib/ask-agent"
import { epicAgentStore, type EpicAgent } from "@/lib/chats"

export const AGENT_LABEL: Record<EpicAgent["status"], string> = {
  running: "Agent working",
  "needs-answer": "Agent needs you",
  review: "Plan to review",
}

/** The chat working on epic `id`, if any (published by ChatPanel). */
export function useEpicAgent(id: string): EpicAgent | undefined {
  return useSyncExternalStore(epicAgentStore.subscribe, () => epicAgentStore.get()[id], () => undefined)
}

/**
 * Pill on an epic while a chat works on it; click opens that chat tab.
 * `nodrag` + stopPropagation keep a React Flow node from dragging/selecting on click.
 */
export function AgentMark({ id, className }: { id: string; className?: string }) {
  const agent = useEpicAgent(id)
  if (!agent) return null
  const label = AGENT_LABEL[agent.status]
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openAgentChat(agent.chatId) }}
      title={`${label} · open chat`}
      aria-label={`${label}, open chat`}
      className={cn(
        "nodrag inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10px] leading-4",
        agent.status === "running" && "border-accent/50 text-accent",
        agent.status === "needs-answer" && "border-amber/50 text-amber",
        agent.status === "review" && "border-accent/50 bg-accent/10 text-accent",
        className,
      )}
    >
      {agent.status === "running" ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
      {label}
    </button>
  )
}

/** Non-interactive variant for places that are already a button (timeline markers and chips). */
export function AgentDot({ id }: { id: string }) {
  const agent = useEpicAgent(id)
  if (!agent) return null
  const label = AGENT_LABEL[agent.status]
  return (
    <span title={label} aria-label={label} role="img" className="inline-flex shrink-0">
      {agent.status === "running"
        ? <Loader2 className="size-3 animate-spin text-accent" />
        : <span className={cn("size-1.5 rounded-full", agent.status === "needs-answer" ? "bg-amber" : "bg-accent")} />}
    </span>
  )
}
