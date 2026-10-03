"use client"

import { useState, type RefObject } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ENTRY_TYPES, type Entry, type EntryType } from "@/lib/entries"
import { cn } from "@/lib/utils"

export type MergeInput = { keepId: string; dropIds: string[]; type: EntryType; summary: string; body: string }

/** The kept entry's fields; the body is the kept body plus the others' bodies under `---`. */
function draftFor(keep: Entry, group: Entry[]) {
  const body = [keep, ...group.filter((e) => e.id !== keep.id)].map((e) => e.body.trim()).filter(Boolean).join("\n\n---\n\n")
  return { type: keep.type, summary: keep.summary, body }
}

/** Approve a suggested duplicate merge (R051). Nothing is merged until Approve. Mount with a key per group. */
export function MergeDialog({ group, onClose, onApprove, returnFocus }: {
  /** the suggested entries, at least two */
  group: Entry[]
  onClose: () => void
  /** Returns an error message to show, or null on success. */
  onApprove: (input: MergeInput) => Promise<string | null>
  /** focused again on close (Esc / Cancel), when it is still on the page */
  returnFocus?: RefObject<HTMLElement | null>
}) {
  const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
  const [keepId, setKeepId] = useState(sorted[0].id)
  const [draft, setDraft] = useState(() => draftFor(sorted[0], sorted))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = (id: string) => {
    setKeepId(id)
    setDraft(draftFor(sorted.find((e) => e.id === id) ?? sorted[0], sorted))
  }

  async function approve() {
    if (busy || !draft.summary.trim()) return
    setBusy(true)
    const err = await onApprove({ keepId, dropIds: sorted.filter((e) => e.id !== keepId).map((e) => e.id), ...draft })
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          const el = returnFocus?.current
          if (el?.isConnected) { e.preventDefault(); el.focus() }
        }}
        className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-surface text-txt shadow-xl shadow-black/20">
        <DialogTitle className="text-sm font-semibold text-txt">Merge entries</DialogTitle>
        <DialogDescription className="text-xs text-muted">
          Pick the entry to keep and edit the merged text. The others are deleted; mentions of them point to the kept id.
        </DialogDescription>
        <form
          onSubmit={(e) => { e.preventDefault(); void approve() }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void approve() } }}
          className="flex min-w-0 flex-col gap-3"
        >
          <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Entry to keep</legend>
            {sorted.map((e) => (
              <label
                key={e.id}
                className={cn(
                  "flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-bg p-3 transition-colors duration-(--duration-fast)",
                  e.id === keepId ? "border-accent" : "border-border hover:border-border2",
                )}
              >
                <span className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="keep"
                    value={e.id}
                    checked={e.id === keepId}
                    onChange={() => pick(e.id)}
                    className="size-3.5 accent-accent focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  <span className="font-mono text-[11px] text-muted">{e.id}</span>
                  <span className="font-mono text-[10px] text-muted">{e.type}</span>
                  <span className="ml-auto text-muted">{e.id === keepId ? "Keep" : "Delete"}</span>
                </span>
                <span className="text-[13px] font-medium text-txt">{e.summary}</span>
                {e.body && <span className="line-clamp-6 whitespace-pre-wrap font-mono text-[11px] text-muted">{e.body}</span>}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Type
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as EntryType })}
              className="h-8 rounded-md border border-border bg-bg px-2 text-sm text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Merged summary (one line)
            <Input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} maxLength={200} className="h-8 text-txt" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Merged details (markdown)
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto font-mono text-[11px] text-muted">⌘↵ approve · Esc cancel</span>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy || !draft.summary.trim()}>
              {busy ? "Merging…" : `Merge into ${keepId}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
