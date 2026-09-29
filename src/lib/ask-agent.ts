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
