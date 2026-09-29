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
  /** The epic this chat is breaking down (from a "Break down epic R…" message); the roadmap shows its status */
  epicId: string | null
}

export function addChat<M>(chats: Chat<M>[], id: string, title = "New chat"): Chat<M>[] {
  return [...chats, { id, title, messages: [], sessionId: null, busy: false, notes: [], epicId: null }]
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

/** What the roadmap shows on an epic while a chat works on it. Idle and errored chats show nothing. */
export interface EpicAgent { status: Exclude<ChatStatus, "idle" | "error">; chatId: string }

const EPIC_RANK = { running: 3, "needs-answer": 2, review: 1 } as const

/** epicId → the most urgent chat on it (running > needs-answer > review). */
export function epicAgents(chats: Chat<StatusMessage>[]): Record<string, EpicAgent> {
  const out: Record<string, EpicAgent> = {}
  for (const c of chats) {
    const status = chatStatus(c)
    if (!c.epicId || status === "idle" || status === "error") continue
    const cur = out[c.epicId]
    if (!cur || EPIC_RANK[status] > EPIC_RANK[cur.status]) out[c.epicId] = { status, chatId: c.id }
  }
  return out
}

// Chat state for UI outside ChatPanel (roadmap), published by ChatPanel. useSyncExternalStore-shaped.
function store<T>(initial: T, same: (a: T, b: T) => boolean) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      if (same(value, next)) return
      value = next
      for (const l of listeners) l()
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => { listeners.delete(l) }
    },
  }
}

/** Running-chat count: the breakdown dialog's free slots. */
export const runningChats = store(0, (a, b) => a === b)
/** epicId → EpicAgent: the map node, timeline and item sheet show it. */
export const epicAgentStore = store<Record<string, EpicAgent>>({}, (a, b) => JSON.stringify(a) === JSON.stringify(b))

/** Chats waiting on the user; the header badge, page title and desktop notifications count these. */
export const isWaiting = (s: ChatStatus): s is "needs-answer" | "review" => s === "needs-answer" || s === "review"
export const waitingChats = store(0, (a, b) => a === b)

/** Chats that became waiting since `prev` (id → last status), so each one notifies once per change. */
export function newlyWaiting<C extends Chat<StatusMessage>>(prev: Record<string, ChatStatus>, chats: C[]): { chat: C; status: "needs-answer" | "review" }[] {
  return chats.flatMap((chat) => {
    const status = chatStatus(chat)
    return isWaiting(status) && prev[chat.id] !== status ? [{ chat, status }] : []
  })
}

/** "(2) VibeDoc" while 2 chats wait; the plain title otherwise. Idempotent. */
export function waitingTitle(title: string, n: number): string {
  const base = title.replace(/^\(\d+\) /, "")
  return n > 0 ? `(${n}) ${base}` : base
}

/** The epic a message asks to break down: the roadmap's "Break down with agent" wording, or the same typed by hand. */
export function epicOf(message: string): string | null {
  return message.trim().match(/^Break down epic (R\d+)/i)?.[1].toUpperCase() ?? null
}

export function chatTitle(firstMessage: string): string {
  const epic = epicOf(firstMessage)
  if (epic) return `Break down ${epic}`
  const line = firstMessage.trim().split("\n")[0]
  return line.length > 30 ? `${line.slice(0, 30).trimEnd()}…` : line
}
