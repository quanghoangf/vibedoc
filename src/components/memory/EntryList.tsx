"use client"

import { useMemo, useState } from "react"
import { Lightbulb, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { ENTRY_TYPES, type Entry, type EntryType } from "@/lib/entries"
import { filterEntries, tokenize } from "@/lib/recall"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { useEntryTypeLabel } from "./entry-type"
import { EmptyState } from "@/components/shared/EmptyState"
import { CopyCommand } from "@/components/shared/CopyCommand"

/** What the empty list hands the user to paste to their agent: imports Claude Code's own memory as entries (R052). */
const IMPORT_PROMPT = 'vibedoc_import_memory { source: "claude-code" }'

/**
 * An entry on the Memory tab. Another repo's group entry (R103) carries its `project` and the id `<project id>:E003`;
 * its own id is the part after the colon.
 */
export type ListedEntry = Entry & { project?: { id: string; name: string; root: string } }

type Scope = "project" | "shared"

/**
 * Knowledge entries (R046) with search (ranked like vibedoc_recall) and a type filter; a project in a group (R103)
 * also gets a scope filter.
 */
export function EntryList({ entries, selectedId, onOpen, onNew, grouped = false, teach = false }: {
  entries: ListedEntry[]
  selectedId?: string | null
  onOpen: (id: string) => void
  onNew: () => void
  grouped?: boolean
  /** No entries: show the teaching empty state (the page has no other one) instead of a one-line note */
  teach?: boolean
}) {
  const { demo } = useApp()
  const { t } = useT()
  const typeLabel = useEntryTypeLabel()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<EntryType | null>(null)
  const [scope, setScope] = useState<Scope | null>(null)
  const shown = useMemo(() => filterEntries(entries, { query, type, scope: grouped ? scope : null }), [entries, query, type, scope, grouped])
  const sharedCount = useMemo(() => entries.filter((e) => e.scope === "group").length, [entries])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of entries) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  }, [entries])
  const searching = tokenize(query).length > 0

  const chipButton = (pressed: boolean, onClick: () => void, label: string, count: number) => (
    <button
      key={label}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-6 rounded-[5px] border border-transparent px-2 text-xs font-medium text-muted outline-none transition-colors",
        "hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
        pressed && "border-border2 bg-surface2 text-txt",
      )}
    >
      {label} <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  )
  const chip = (value: EntryType | null, label: string, count: number) => chipButton(type === value, () => setType(value), label, count)
  const scopeChip = (value: Scope | null, label: string, count: number) => chipButton(scope === value, () => setScope(value), label, count)

  return (
    <section aria-label={t("memory.knowledgeEntries")} className="flex min-w-0 flex-col gap-3 lg:max-w-[26rem]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight">{t("memory.knowledgeEntries")}</h2>
        {!demo && <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted outline-none hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="size-3.5" aria-hidden /> {t("memory.newEntry")}
        </button>}
      </div>

      {entries.length > 0 && <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          id="memory-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("memory.searchEntries")}
          aria-label={t("memory.searchEntriesLabel")}
          className="h-8 pl-8"
        />
      </div>

      <div role="group" aria-label={t("memory.filterByType")} className="flex flex-wrap gap-1">
        {chip(null, t("memory.all"), entries.length)}
        {ENTRY_TYPES.map((type) => chip(type, typeLabel(type), counts[type] ?? 0))}
      </div>

      {grouped && (
        <div role="group" aria-label={t("memory.filterByScope")} className="flex flex-wrap gap-1">
          {scopeChip(null, t("memory.all"), entries.length)}
          {scopeChip("project", t("memory.scopeThisProject"), entries.length - sharedCount)}
          {scopeChip("shared", t("memory.scopeShared"), sharedCount)}
        </div>
      )}
      </>}

      {entries.length === 0 && teach ? (
        // the page's one empty state while the handoff has text (an empty handoff teaches instead, R083)
        <EmptyState
          icon={<Lightbulb className="size-6" />}
          message={t("memory.noEntries")}
          lead={t("memory.noEntriesTeach")}
          action={<CopyCommand command={IMPORT_PROMPT} prompt={false} />}
          needsAgent
          bordered
        />
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          {t("memory.noEntriesLead")} <code className="font-mono text-xs">vibedoc_save_entry</code>.
        </p>
      ) : shown.length === 0 ? (
        <p className="p-2 text-sm text-muted">
          {searching ? t("memory.noMatchQuery", { query: query.trim() }) : t("memory.noMatchFilter")}
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
                  e.id === selectedId && "bg-surface2 shadow-[inset_2px_0_0_var(--color-accent-edge)]",
                )}
              >
                <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span>{e.id}</span>
                  <span>·</span>
                  <span>{typeLabel(e.type)}</span>
                  {e.scope === "group" && (
                    <span data-shared-from={e.project?.id ?? ""} className="rounded-[4px] border border-border px-1 font-sans text-[10px]">
                      {e.project ? <span data-user-content>{e.project.name}</span> : t("memory.scopeShared")}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <OwnerChip owner={e.by} className="font-sans" />
                    {e.updatedAt}
                  </span>
                </span>
                <span data-user-content className="text-sm text-txt">{e.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
