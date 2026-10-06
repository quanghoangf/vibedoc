"use client"

import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { TOO_MANY_CHATS, type ChatStatus } from "@/lib/chats"

const STATUS_KEY: Record<ChatStatus, MessageKey> = {
  running: "chat.statusRunning",
  "needs-answer": "chat.statusNeedsAnswer",
  review: "chat.statusReview",
  error: "chat.statusError",
  idle: "chat.statusIdle",
}

const AGENT_KEY: Record<"running" | "needs-answer" | "review", MessageKey> = {
  running: "chat.agentWorking",
  "needs-answer": "chat.agentNeedsYou",
  review: "chat.planToReview",
}

// suggestions() in src/lib/chats.ts stays English (it is what gets sent, and epicOf matches it); this is what the chip shows.
const SUGGESTION_KEY: Record<string, MessageKey> = {
  "What should I work on next?": "chat.sugNext",
  "Plan a roadmap for this project.": "chat.sugRoadmap",
  "What is blocked right now?": "chat.sugBlocked",
  "Summarize this epic's progress.": "chat.sugEpicProgress",
  "What is at risk in this epic?": "chat.sugEpicRisk",
  "Refine this task's spec.": "chat.sugRefine",
  "Split this task into smaller tasks.": "chat.sugSplit",
  "What blocks this task?": "chat.sugTaskBlocks",
}

export function useChatText() {
  const { t } = useT()
  return {
    status: (s: ChatStatus) => t(STATUS_KEY[s]),
    agent: (s: keyof typeof AGENT_KEY) => t(AGENT_KEY[s]),
    suggestion: (s: string) => {
      const epic = /^Break down epic (\S+) into tasks\.$/.exec(s)
      if (epic) return t("chat.sugBreakDown", { id: epic[1] })
      return SUGGESTION_KEY[s] ? t(SUGGESTION_KEY[s]) : s
    },
    /** A chat's title: the ones VibeDoc names (new chat, attachTitle, chatTitle's "Break down R…") translated, typed ones as written. */
    title: (s: string) => {
      if (s === "New chat") return t("chat.newChat")
      const m = /^(Epic|Task|Break down) ([RT]\d+)$/.exec(s)
      if (!m) return s
      return t(m[1] === "Epic" ? "chat.titleEpic" : m[1] === "Task" ? "chat.titleTask" : "chat.titleBreakDown", { id: m[2] })
    },
    /** A notice from the store: the running-chat cap is translated, anything else (a server error) shows as sent. */
    notice: (n: string) => (n === TOO_MANY_CHATS ? t("chat.tooMany", { n: n.match(/\d+/)?.[0] ?? "" }) : n),
  }
}
