export const ASK_AGENT_EVENT = "vibedoc:ask-agent"

export interface AskAgentDetail {
  message: string
  /** Always open a new chat tab; otherwise the active chat is reused when idle */
  newChat?: boolean
  /** Show the new chat too (a newChat ask otherwise runs in the background) */
  open?: boolean
}

/** Opens the chat sidebar and sends `message` (layout.tsx opens it, ChatPanel sends). */
export function askAgent(message: string, opts: { newChat?: boolean; open?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<AskAgentDetail>(ASK_AGENT_EVENT, { detail: { message, ...opts } }))
}

/** R067: a new chat checks a finished task against what was asked and reports findings on it. */
export function verifyTask(taskId: string) {
  askAgent(`Verify task ${taskId}: call vibedoc_verify_context, then vibedoc_report_findings.`, { newChat: true })
}

export const OPEN_CHAT_EVENT = "vibedoc:open-chat"

/** Opens the chat sidebar on tab `chatId` (e.g. from an epic's "agent working" marker). */
export function openAgentChat(chatId: string) {
  window.dispatchEvent(new CustomEvent<{ chatId: string }>(OPEN_CHAT_EVENT, { detail: { chatId } }))
}

export interface TaskDraft {
  title: string
  epic: string | null
  dependsOn: string[]
  size: string
  priority: string | null
  description: string
  /** Project-relative paths of the attached images (plans/tasks/assets/draft-…/n.png) */
  images: string[]
}

/** T512: the New Task draft as a chat that asks what's missing, then proposes one well-formed task (Accept creates it). */
export function taskDraftPrompt(d: TaskDraft): string {
  const lines = [
    `Help me turn this draft into one task an agent can pick up.`,
    ``,
    `- Title: ${d.title || "(none yet)"}`,
    `- Epic: ${d.epic ?? "none (a loose task)"}`,
    `- Depends on: ${d.dependsOn.join(", ") || "—"}`,
    `- Size: ${d.size || "—"}`,
    `- Priority: ${d.priority ?? "—"}`,
    `- Description:`,
    d.description.trim() ? d.description.trim().split("\n").map((l) => `  ${l}`).join("\n") : "  —",
  ]
  if (d.images.length) {
    lines.push(`- Attached images (look at each with vibedoc_get_attachment; keep them in the task body as markdown images, relative to plans/tasks/):`)
    for (const p of d.images) lines.push(`  - ${p} → ![](${p.replace(/^plans\/tasks\//, "")})`)
  }
  lines.push(
    ``,
    `Read the epic and the code areas it touches with the vibedoc_* tools. If something important is missing or unclear, ask me with vibedoc_ask_questions first.`,
    `Then call vibedoc_propose_plan with kind "breakdown"${d.epic ? `, epic "${d.epic}"` : ` and no epic`}, and exactly one task, keeping the title, size and dependencies above unless we changed them. Its body follows the breakdown template: ## Goal, ## Context, ## Scope, ## Files, ## Acceptance criteria, ## Verify. Don't create the task any other way: I accept the plan card.`,
  )
  return lines.join("\n")
}
