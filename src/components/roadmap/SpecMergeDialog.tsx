"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/context/AppContext"
import { lineDiff, visibleHunks } from "@/lib/diff"
import { cn } from "@/lib/utils"
import type { SpecMergePreview } from "@/lib/core"

/**
 * R069: an epic's `## Spec changes` as a diff per capability spec; Accept writes them (POST /api/roadmap/spec-merge,
 * recomputed on the server) and stamps the epic. Any error disables Accept and is listed under its spec.
 */
export function SpecMergeDialog({ epicId, open, onOpenChange }: { epicId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { rootParam } = useApp()
  const [merges, setMerges] = useState<SpecMergePreview[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sep = rootParam ? "&" : "?"

  useEffect(() => {
    if (!open) return
    let live = true
    fetch(`/api/roadmap/spec-merge${rootParam}${sep}id=${encodeURIComponent(epicId)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`); return d })
      .then((d) => { if (live) { setMerges(d.merges); setError(null) } })
      .catch((e) => { if (live) setError((e as Error).message) })
    return () => { live = false; setMerges(null) }
  }, [open, epicId, rootParam, sep])

  const blocked = !merges || !merges.length || merges.some((m) => m.errors.length > 0)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/roadmap/spec-merge${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: epicId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`)
      toast(`Merged ${epicId} into ${d.paths.join(", ")}`)
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">Merge {epicId} into the capability spec</DialogTitle>
        <DialogDescription className="text-xs text-muted">
          The epic&apos;s spec changes, applied to each capability spec. Accept writes them; edit the spec afterwards if the wording needs work.
        </DialogDescription>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {!merges && !error && <p className="text-xs text-muted">Loading…</p>}
          {merges?.length === 0 && <p className="text-xs text-muted">This epic has no ## Spec changes.</p>}
          {merges?.map((m) => <MergeDiff key={m.path} merge={m} />)}
        </div>
        {error && <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" size="sm" disabled={blocked || busy} onClick={accept} className="bg-accent text-accent-fg hover:bg-accent/90">
            {busy ? "Merging…" : "Accept"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MergeDiff({ merge: m }: { merge: SpecMergePreview }) {
  const hunks = useMemo(() => visibleHunks(lineDiff(m.before, m.after)), [m.before, m.after])
  return (
    <section aria-label={m.path} className="overflow-hidden rounded-xl border border-border bg-bg">
      <p className="border-b border-border bg-surface2 px-3 py-1.5 font-mono text-[11px] text-muted">
        {m.path}{m.isNew && <span className="ml-2 text-teal">new</span>}
      </p>
      {m.errors.length > 0 && (
        <ul role="alert" className="border-b border-border px-3 py-1.5 text-xs text-danger">
          {m.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <div className="font-mono text-[11px] leading-5">
        {hunks.map((h, i) =>
          typeof h === "number" ? (
            <div key={i} className="bg-surface2/50 px-3 text-muted">⋯ {h} unchanged line{h > 1 ? "s" : ""}</div>
          ) : (
            <div key={i} className={cn("whitespace-pre-wrap break-words px-3", h.op === "+" && "bg-teal/10 text-teal", h.op === "-" && "bg-danger/10 text-danger")}>
              {h.op === "-" ? "−" : h.op}{" "}{h.text || " "}
            </div>
          ),
        )}
      </div>
    </section>
  )
}
