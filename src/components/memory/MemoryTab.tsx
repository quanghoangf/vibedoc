import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { EmptyState } from "@/components/shared/EmptyState"

interface MemoryTabProps {
  memory: { content: string; exists: boolean } | null
}

export function MemoryTab({ memory }: MemoryTabProps) {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl">Session Memory</h1>
        <span className="text-xs font-mono text-muted">memory/MEMORY.md</span>
      </div>

      {memory?.exists ? (
        <div className="bg-surface border border-border rounded-xl p-5">
          <MarkdownRenderer content={memory.content} />
        </div>
      ) : (
        <EmptyState
          icon="🧠"
          message="No MEMORY.md yet."
          subMessage="AI will create one at the end of the first session."
          bordered
        />
      )}

      <div className="mt-4 p-4 bg-surface2 border border-border rounded-xl">
        <p className="text-xs font-mono text-muted mb-2">
          Add to your CLAUDE.md system prompt:
        </p>
        <pre className="text-xs font-mono text-accent/80 whitespace-pre-wrap leading-relaxed">{`At session start:
1. Call vibedoc_read_memory
2. Call vibedoc_get_status

At session end:
- Call vibedoc_update_memory with full handoff`}</pre>
      </div>
    </div>
  )
}
