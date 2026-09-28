export const ASK_AGENT_EVENT = "vibedoc:ask-agent"

/** Opens the chat sidebar and sends `message` (layout.tsx opens it, ChatPanel sends). */
export function askAgent(message: string) {
  window.dispatchEvent(new CustomEvent(ASK_AGENT_EVENT, { detail: { message } }))
}
