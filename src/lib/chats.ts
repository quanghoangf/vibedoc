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

export function patchChat<M>(chats: Chat<M>[], id: string, fn: (c: Chat<M>) => Chat<M>): Chat<M>[] {
  return chats.map((c) => (c.id === id ? fn(c) : c))
}

/** Where an askAgent() message goes: the active chat when it is idle, otherwise a new tab. */
export function routeAsk(
  chats: Chat[],
  activeId: string | null,
  opts: { newChat?: boolean } = {},
): { chatId: string } | { newChat: true } {
  const active = chats.find((c) => c.id === activeId)
  return active && !active.busy && !opts.newChat ? { chatId: active.id } : { newChat: true }
}

export function chatTitle(firstMessage: string): string {
  const epic = firstMessage.match(/^Break down epic (R\d+)/)
  if (epic) return `Break down ${epic[1]}`
  const line = firstMessage.trim().split("\n")[0]
  return line.length > 30 ? `${line.slice(0, 30).trimEnd()}…` : line
}
