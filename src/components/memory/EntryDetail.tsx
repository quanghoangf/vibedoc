"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ItemPanelHeader } from "@/components/shared/ItemPanelHeader"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { ENTRY_TYPES, validateEntryInput, type Entry, type EntryType } from "@/lib/entries"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { useEntryTypeLabel } from "./entry-type"

type Draft = { type: EntryType; summary: string; body: string }

/**
 * One knowledge entry: read view with Edit, or the edit form. `entry` null = a new entry (form only).
 * R053 adds its panels (Related, History) under the body via `children`.
 */
export function EntryDetail({ entry, rootParam, onSaved, onDelete, onClose, children }: {
  entry: Entry | null
  rootParam: string
  onSaved: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onClose: () => void
  children?: ReactNode
}) {
  const { demo } = useApp()
  const { t } = useT()
  const typeLabel = useEntryTypeLabel()
  const [editing, setEditing] = useState(entry === null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(entry))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEdit = () => { setDraft(toDraft(entry)); setError(null); setEditing(true) }
  const cancel = () => { if (entry) { setEditing(false); setError(null) } else onClose() }

  const save = async () => {
    // same rules as the server, so a bad summary never costs a request
    const invalid = validateEntryInput({ ...draft, id: entry?.id })
    if (invalid) { setError(invalid); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/memory/entries/save${rootParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(entry ? { id: entry.id } : {}), ...draft }),
      })
      const data = (await res.json().catch(() => ({}))) as { entry?: Entry; error?: string }
      if (!res.ok || !data.entry) throw new Error(data.error ?? t("memory.saveFailed", { status: res.status }))
      setEditing(false)
      onSaved(data.entry)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // ⌫ / Delete deletes the open entry, unless the user is typing somewhere
  useEffect(() => {
    if (editing || !entry || demo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return
      e.preventDefault()
      onDelete(entry)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editing, entry, onDelete, demo])

  const closeButton = (
    <button type="button" onClick={onClose} aria-label={t("memory.closeEntry")} className="rounded p-1 text-muted hover:bg-surface2 hover:text-txt">
      <X className="size-3.5" />
    </button>
  )

  if (editing) {
    return (
      <section aria-label={entry ? t("memory.editEntry", { id: entry.id }) : t("memory.newEntry")} className="rounded-xl border border-border bg-surface">
        <form
          onSubmit={(e) => { e.preventDefault(); void save() }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel() }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() }
          }}
          className="flex flex-col gap-3 p-5"
        >
          <div className="flex items-center justify-between font-mono text-[11px] text-muted">
            <span>{entry ? t("memory.editingKicker", { id: entry.id }) : t("memory.newEntry")}</span>
            {closeButton}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("memory.type")}
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
              className="h-8 rounded-md border border-border bg-bg px-2 text-sm text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              {ENTRY_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("memory.summaryLine")}
            <Input
              autoFocus
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              maxLength={200}
              className="h-8 text-txt"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("memory.detailsMarkdown")}
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-muted">{t("memory.saveHint")}</span>
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>{t("board.cancel")}</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? t("memory.saving") : t("board.save")}</Button>
          </div>
        </form>
      </section>
    )
  }

  if (!entry) return null
  return (
    <section aria-label={entry.id} className="rounded-xl border border-border bg-surface">
      <ItemPanelHeader
        kicker={<span>{t("memory.entryKicker", { id: entry.id })}</span>}
        menu={
          <span className="flex items-center gap-1">
            {!demo && <>
            <Button variant="ghost" size="sm" onClick={startEdit} className="h-7 px-2 text-xs">
              <Pencil className="size-3.5" /> {t("board.edit")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(entry)} title={t("memory.deleteKey")} className="h-7 px-2 text-xs hover:text-danger">
              <Trash2 className="size-3.5" /> {t("board.delete")}
            </Button>
            </>}
            {closeButton}
          </span>
        }
        title={<span data-user-content>{entry.summary}</span>}
        properties={[
          { label: t("memory.type"), id: "type", value: typeLabel(entry.type) },
          { label: t("memory.updated"), id: "updated", value: entry.updatedAt || null },
          { label: t("memory.changedBy"), id: "by", value: entry.by ? <OwnerChip owner={entry.by} className="text-xs text-txt" /> : null },
          { label: t("memory.file"), id: "file", value: <span className="truncate font-mono text-[11px] text-muted">{entry.file}</span> },
        ]}
      />
      <div className="p-5">
        {entry.body ? <MarkdownRenderer content={entry.body} /> : <p className="text-sm text-muted">{t("memory.noDetails")}</p>}
        {children}
      </div>
    </section>
  )
}

function toDraft(entry: Entry | null): Draft {
  return entry ? { type: entry.type, summary: entry.summary, body: entry.body } : { type: "convention", summary: "", body: "" }
}
