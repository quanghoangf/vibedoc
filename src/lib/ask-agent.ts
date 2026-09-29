export const ASK_AGENT_EVENT = "vibedoc:ask-agent"

export interface AskAgentDetail {
  message: string
  /** Always open a new chat tab; otherwise the active chat is reused when idle */
  newChat?: boolean
}

/** Opens the chat sidebar and sends `message` (layout.tsx opens it, ChatPanel sends). */
export function askAgent(message: string, opts: { newChat?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<AskAgentDetail>(ASK_AGENT_EVENT, { detail: { message, ...opts } }))
}

export const OPEN_CHAT_EVENT = "vibedoc:open-chat"

/** Opens the chat sidebar on tab `chatId` (e.g. from an epic's "agent working" marker). */
export function openAgentChat(chatId: string) {
  window.dispatchEvent(new CustomEvent<{ chatId: string }>(OPEN_CHAT_EVENT, { detail: { chatId } }))
}
