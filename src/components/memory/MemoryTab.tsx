import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { EmptyState } from "@/components/shared/EmptyState"
import type { Entry } from "@/lib/entries"
import { EntryList } from "./EntryList"
import { EntryDetail } from "./EntryDetail"
import { EntryRelated } from "./EntryRelated"
import { EntryHistory } from "./EntryHistory"
import { MemoryGraph } from "./MemoryGraph"
import { CleanupPanel } from "./CleanupPanel"
import { MemoryHistory } from "./MemoryHistory"
import type { MergeInput } from "./MergeDialog"
import type { CleanupFlag, MemoryVersion } from "@/lib/core"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import { useApp } from "@/context/AppContext"

interface MemoryTabProps {
  memory: { content: string; exists: boolean } | null
  /** null while loading */
  entries: Entry[] | null
  rootParam: string
  /** The open entry id (from ?entry=), or null */
  selectedId: string | null
  /** The New entry form is open */
  creating: boolean
  onOpen: (id: string) => void
  onNew: () => void
  onClose: () => void
  onSaved: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  view: "list" | "graph"
  onView: (view: "list" | "graph") => void
  /** Health flags incl. dismissed ones (null while loading) */
  flags: CleanupFlag[] | null
  /** The Cleanup panel is open (?cleanup=1) */
  cleanup: boolean
  onCleanup: (open: boolean) => void
  onDismiss: (flag: CleanupFlag) => void
  onMerge: (input: MergeInput) => Promise<string | null>
  /** Delete from a "Not recalled lately" row; the Cleanup panel stays open */
  onDeleteStale: (id: string) => void
  /** Saved MEMORY.md versions (null while loading) */
  versions: MemoryVersion[] | null
  /** The history pane is open (?history=1) and its selected version (?version=) */
  history: boolean
  versionId: string | null
  onHistory: (open: boolean, versionId?: string | null) => void
  onRestore: (version: MemoryVersion) => Promise<void>
}

export function MemoryTab({ memory, entries, rootParam, selectedId, creating, onOpen, onNew, onClose, onSaved, onDelete, view, onView, flags, cleanup, onCleanup, onDismiss, onMerge, onDeleteStale, versions, history, versionId, onHistory, onRestore }: MemoryTabProps) {
  const selected = selectedId ? entries?.find((e) => e.id === selectedId) : undefined
  const open = flags?.filter((f) => !f.dismissed) ?? []
  const warn = open.some((f) => f.severity === "warn")
  // Cleanup only dismisses, merges and deletes: none of it in the read-only demo (R042)
  const { demo } = useApp()
  return (
    <div className={cn(
      "grid items-start gap-6 p-6",
      view === "graph" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]" : "lg:grid-cols-[minmax(280px,380px)_minmax(0,42rem)]",
    )}>
      <div className="flex items-center justify-between gap-4 lg:col-span-2">
        <h1 className="font-display text-xl font-semibold tracking-tight">Memory</h1>
        <div className="flex items-center gap-2">
          {!demo && <button
            type="button"
            aria-pressed={cleanup}
            onClick={() => onCleanup(!cleanup)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted outline-none transition-colors duration-(--duration-fast)",
              "hover:border-border2 hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
              cleanup && "border-border2 bg-surface2 text-txt",
            )}
          >
            {warn && <AlertTriangle className="size-3.5 text-amber" aria-hidden />}
            Cleanup <span className="font-mono text-[11px]">({open.length})</span>
          </button>}
          <div role="group" aria-label="Entries view" className="flex rounded-md border border-border p-0.5">
            {(["list", "graph"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => onView(v)}
                className={cn(
                  "h-6 rounded-[5px] border border-transparent px-2.5 text-xs font-medium capitalize text-muted outline-none transition-colors",
                  "hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
                  view === v && "border-border2 bg-surface2 text-txt",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      {entries && view === "graph" ? (
        <MemoryGraph entries={entries} selectedId={selectedId} onOpenEntry={onOpen} />
      ) : entries ? (
        <EntryList entries={entries} selectedId={selectedId} onOpen={onOpen} onNew={onNew} />
      ) : (
        <p className="text-sm text-muted">Loading entries…</p>
      )}
      {creating || selected ? (
        <div className="min-w-0 lg:sticky lg:top-6">
          <EntryDetail key={creating ? "new" : selected?.id} entry={creating ? null : selected ?? null} rootParam={rootParam} onSaved={onSaved} onDelete={onDelete} onClose={onClose}>
            {selected && !creating && (
              <>
                <EntryRelated entryId={selected.id} onOpenEntry={onOpen} />
                <EntryHistory entryId={selected.id} />
              </>
            )}
          </EntryDetail>
        </div>
      ) : cleanup && !demo ? (
        <div className="min-w-0 lg:sticky lg:top-6">
          <CleanupPanel flags={flags} entries={entries} onDismiss={onDismiss} onMerge={onMerge} onDelete={onDeleteStale} onOpenEntry={onOpen} onClose={() => onCleanup(false)} />
        </div>
      ) : selectedId && entries ? (
        <div role="alert" className="min-w-0 rounded-xl border border-dashed border-border p-5 text-sm text-muted">
          Entry {selectedId} not found.{" "}
          <button type="button" onClick={onClose} className="text-txt underline underline-offset-2">Show the handoff</button>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="font-display text-base font-semibold tracking-tight">Session handoff</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted">memory/MEMORY.md</span>
              <button
                type="button"
                aria-pressed={history}
                onClick={() => onHistory(!history)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted outline-none transition-colors duration-(--duration-fast)",
                  "hover:border-border2 hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
                  history && "border-border2 bg-surface2 text-txt",
                )}
              >
                History <span className="font-mono text-[11px]">({versions?.length ?? "…"})</span>
              </button>
            </div>
          </div>

          {history ? (
            <MemoryHistory
              versions={versions}
              current={memory?.exists ? memory.content : ""}
              rootParam={rootParam}
              selectedId={versionId}
              onSelect={(id) => onHistory(true, id)}
              onClose={() => onHistory(false)}
              onRestore={onRestore}
            />
          ) : memory?.exists ? (
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
   If it shows ⚠ Memory warnings, fix the handoff with vibedoc_update_memory first
2. Call vibedoc_get_status

When you learn a fact that should still hold next week:
- Call vibedoc_save_entry (convention, gotcha, decision, preference)

At session end:
- Call vibedoc_update_memory with full handoff`}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
