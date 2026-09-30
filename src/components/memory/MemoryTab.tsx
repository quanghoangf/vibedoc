import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { EmptyState } from "@/components/shared/EmptyState"
import type { Entry } from "@/lib/entries"
import { EntryList } from "./EntryList"

interface MemoryTabProps {
  memory: { content: string; exists: boolean } | null
  /** null while loading */
  entries: Entry[] | null
}

export function MemoryTab({ memory, entries }: MemoryTabProps) {
  return (
    <div className="grid items-start gap-6 p-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,42rem)]">
      <h1 className="font-display text-xl font-semibold tracking-tight lg:col-span-2">Memory</h1>
      {entries ? <EntryList entries={entries} /> : <p className="text-sm text-muted">Loading entries…</p>}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-base font-semibold tracking-tight">Session handoff</h2>
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

When you learn a fact that should still hold next week:
- Call vibedoc_save_entry (convention, gotcha, decision, preference)

At session end:
- Call vibedoc_update_memory with full handoff`}</pre>
        </div>
      </div>
    </div>
  )
}
