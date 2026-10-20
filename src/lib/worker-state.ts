/**
 * src/lib/worker-state.ts (R108 T557)
 * What a worker's stream says about it. Pure: the server folds a task turn's lines into the saved chat, the chat page
 * folds the same lines live.
 */

/** A tool call Claude Code refused: a deny rule (`git push`) or a command not on the allowlist. */
export interface RefusedCall { tool: string; input: string }

type Block = { type?: string; id?: string; name?: string; input?: unknown }

const inputText = (input: unknown): string => {
  const o = (input ?? {}) as Record<string, unknown>
  return typeof o.command === 'string' ? o.command : typeof o.file_path === 'string' ? o.file_path : JSON.stringify(input ?? {})
}

/**
 * Refusals in one turn's `stream-json` lines (ADR-007 § Spike): a `system` `permission_denied` event (its input comes
 * from the matching `tool_use`) and `result.permission_denials`. One row per `tool_use_id`, in order.
 */
export function refusedCalls(lines: (string | unknown)[]): RefusedCall[] {
  const inputs = new Map<string, { tool: string; input: string }>()
  const refused = new Map<string, RefusedCall>()
  for (const line of lines) {
    let ev: Record<string, unknown> | null = null
    if (typeof line === 'string') { try { ev = JSON.parse(line) } catch { continue } } else ev = line as Record<string, unknown>
    if (!ev || typeof ev !== 'object') continue
    if (ev.type === 'assistant') {
      const content = ((ev.message as { content?: Block[] } | undefined)?.content ?? [])
      for (const b of content) if (b?.type === 'tool_use' && b.id) inputs.set(b.id, { tool: b.name ?? '', input: inputText(b.input) })
    } else if (ev.type === 'system' && ev.subtype === 'permission_denied') {
      const id = String(ev.tool_use_id ?? `#${refused.size}`)
      const seen = inputs.get(id)
      if (!refused.has(id)) refused.set(id, { tool: String(ev.tool_name ?? seen?.tool ?? ''), input: seen?.input ?? String(ev.message ?? '') })
    } else if (ev.type === 'result' && Array.isArray(ev.permission_denials)) {
      for (const d of ev.permission_denials as { tool_name?: string; tool_use_id?: string; tool_input?: unknown }[]) {
        const id = String(d?.tool_use_id ?? `#${refused.size}`)
        refused.set(id, { tool: String(d?.tool_name ?? ''), input: inputText(d?.tool_input) })
      }
    }
  }
  return [...refused.values()]
}
