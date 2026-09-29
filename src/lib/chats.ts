// Pure helpers for the chat sidebar's tabs (ChatPanel). No React, no fs: `node src/lib/chats.check.mts` runs them.

export interface Chat<M = unknown> {
  id: string
  title: string
  messages: M[]
  /** Claude session to `--resume`; set by the first `session_id` in the stream */
  sessionId: string | null
  busy: boolean
  /** Accept/reject outcomes the agent hasn't heard about yet; sent with this chat's next message */
  notes: string[]
}

export function addChat<M>(chats: Chat<M>[], id: string, title = "New chat"): Chat<M>[] {
  return [...chats, { id, title, messages: [], sessionId: null, busy: false, notes: [] }]
}

/** A missing id (e.g. a closed tab whose stream is still unwinding) is a no-op. */
export function patchChat<M>(chats: Chat<M>[], id: string, fn: (c: Chat<M>) => Chat<M>): Chat<M>[] {
  return chats.map((c) => (c.id === id ? fn(c) : c))
}

/** Closing the active tab activates its right neighbor, else its left one; the last tab leaves none. */
export function closeChat<M>(chats: Chat<M>[], id: string, activeId: string | null): { chats: Chat<M>[]; activeId: string | null } {
  const i = chats.findIndex((c) => c.id === id)
  if (i < 0) return { chats, activeId }
  const rest = chats.filter((c) => c.id !== id)
  return { chats: rest, activeId: id === activeId ? (rest[i] ?? rest[i - 1])?.id ?? null : activeId }
}

/** The fields of a chat message the tab status reads (ChatPanel's ChatMessage has more). */
export interface StatusMessage {
  role: "user" | "assistant"
  questions: { answers?: unknown }[]
  proposals: { status: string }[]
  plans: { status: string }[]
  error?: string
}

export type ChatStatus = "running" | "needs-answer" | "review" | "idle" | "error"

/** Plan and edit cards the user hasn't accepted or rejected yet, across the whole chat. */
export function pendingReviews(chat: Chat<StatusMessage>): number {
  return chat.messages.reduce(
    (n, m) => n + m.plans.filter((p) => p.status === "pending").length + m.proposals.filter((p) => p.status === "pending").length,
    0,
  )
}

/** Precedence: running > needs-answer > review > error > idle. */
export function chatStatus(chat: Chat<StatusMessage>): ChatStatus {
  if (chat.busy) return "running"
  const last = chat.messages[chat.messages.length - 1]
  // Same rule as the input hint: only the latest reply's questions block
  if (last?.questions.some((q) => !q.answers)) return "needs-answer"
  if (pendingReviews(chat)) return "review"
  const lastReply = chat.messages.findLast((m) => m.role === "assistant")
  return lastReply?.error ? "error" : "idle"
}

/** Each running chat is one `claude -p` process. */
export const MAX_RUNNING_CHATS = 4
export const TOO_MANY_CHATS = `Too many agents running (${MAX_RUNNING_CHATS}). Close a tab or wait.`

/**
 * Where an askAgent() message goes: the active chat when it is idle, otherwise a new tab.
 * Refused at the cap. `running` overrides the busy count when `chats` may be stale (several asks in one tick).
 */
export function routeAsk(
  chats: Chat[],
  activeId: string | null,
  opts: { newChat?: boolean; running?: number } = {},
): { chatId: string } | { newChat: true } | { refused: string } {
  if ((opts.running ?? chats.filter((c) => c.busy).length) >= MAX_RUNNING_CHATS) return { refused: TOO_MANY_CHATS }
  const active = chats.find((c) => c.id === activeId)
  return active && !active.busy && !opts.newChat ? { chatId: active.id } : { newChat: true }
}

// Running-chat count for UI outside ChatPanel (the breakdown dialog); ChatPanel publishes it. useSyncExternalStore-shaped.
let running = 0
const listeners = new Set<() => void>()
export const runningChats = {
  get: () => running,
  set(n: number) {
    if (n === running) return
    running = n
    for (const l of listeners) l()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}

export function chatTitle(firstMessage: string): string {
  const epic = firstMessage.match(/^Break down epic (R\d+)/)
  if (epic) return `Break down ${epic[1]}`
  const line = firstMessage.trim().split("\n")[0]
  return line.length > 30 ? `${line.slice(0, 30).trimEnd()}…` : line
}
