"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ENTRY_TYPES, type Entry, type EntryType } from "@/lib/entries"
import { filterEntries, tokenize } from "@/lib/recall"

/** Knowledge entries (R046) with search (ranked like vibedoc_recall) and a type filter. */
export function EntryList({ entries, selectedId, onOpen, onNew }: {
  entries: Entry[]
  selectedId?: string | null
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<EntryType | null>(null)
  const shown = useMemo(() => filterEntries(entries, { query, type }), [entries, query, type])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of entries) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  }, [entries])
  const searching = tokenize(query).length > 0

  const chip = (value: EntryType | null, label: string, count: number) => (
    <button
      key={label}
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={cn(
        "h-6 rounded-[5px] border border-transparent px-2 text-xs font-medium text-muted outline-none transition-colors",
        "hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
        type === value && "border-border2 bg-surface2 text-txt",
      )}
    >
      {label} <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  )

  return (
    <section aria-label="Knowledge entries" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight">Knowledge entries</h2>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted outline-none hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="size-3.5" aria-hidden /> New entry
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          id="memory-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries…"
          aria-label="Search entries"
          className="h-8 pl-8"
        />
      </div>

      <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1">
        {chip(null, "All", entries.length)}
        {ENTRY_TYPES.map((t) => chip(t, t, counts[t] ?? 0))}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No knowledge entries yet. Agents save them with <code className="font-mono text-xs">vibedoc_save_entry</code>.
        </p>
      ) : shown.length === 0 ? (
        <p className="p-2 text-sm text-muted">
          No entries match {searching ? `"${query.trim()}"` : "this filter"}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(e.id)}
                aria-current={e.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2 text-left outline-none transition-colors hover:bg-surface2 focus-visible:bg-surface2",
                  e.id === selectedId && "bg-surface2 shadow-[inset_2px_0_0_var(--color-accent)]",
                )}
              >
                <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span>{e.id}</span>
                  <span>·</span>
                  <span>{e.type}</span>
                  <span className="ml-auto">{e.updatedAt}</span>
                </span>
                <span className="text-sm text-txt">{e.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
