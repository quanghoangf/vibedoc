"use client"

import { useState } from "react"
import { Check, CornerUpLeft, ListChecks, ListX, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { toast, undoToast } from "@/components/ui/toast"
import { REVIEWABLE } from "@/lib/review"
import type { ReviewRow } from "@/lib/test-review"

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json as T
}

type TickResult = { id: string; changed?: number[]; error?: string }
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

const BTN = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs text-txt transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent"

/**
 * The selected rows' actions on /manual-tests: tick / untick every manual check (one request, Undo flips back
 * exactly what changed), approve the ones in review, send back the reviewable ones with one note.
 */
export function TestBulkBar({ rows, onClear }: { rows: ReviewRow[]; onClear: () => void }) {
  const { rootParam, demo } = useApp()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const withChecks = rows.filter((r) => r.manual.total > 0)
  const inReview = rows.filter((r) => REVIEWABLE.approved.includes(r.status))
  const sendable = rows.filter((r) => REVIEWABLE["changes requested"].includes(r.status))

  async function tick(checked: boolean) {
    setBusy(true)
    try {
      const { results } = await post<{ results: TickResult[] }>(`/api/tasks/manual-tests${rootParam}`, { ids: withChecks.map((r) => r.id), checked })
      const done = results.filter((r) => r.changed?.length)
      const failed = results.filter((r) => r.error)
      const items = done.reduce((n, r) => n + (r.changed?.length ?? 0), 0)
      onClear()
      if (failed.length) toast(`${failed.map((r) => r.id).join(", ")}: ${failed[0].error}`)
      if (!items) return void toast(checked ? "Every manual check was already ticked" : "Nothing was ticked")
      undoToast(`${checked ? "Ticked" : "Unticked"} ${plural(items, "check")} on ${plural(done.length, "task")}`, async () => {
        for (const r of done) {
          for (const index of r.changed ?? []) {
            await post(`/api/tasks/manual-tests${rootParam}`, { id: r.id, index, checked: !checked })
          }
        }
      })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function review(action: "approve" | "send-back", targets: ReviewRow[], text = "") {
    setBusy(true)
    const failed: string[] = []
    for (const r of targets) {
      try {
        await post(`/api/tasks/review${rootParam}`, { id: r.id, action, note: text })
      } catch (e) {
        failed.push(`${r.id}: ${(e as Error).message}`)
      }
    }
    setBusy(false)
    setNote(null)
    onClear()
    const ok = targets.length - failed.length
    if (ok) toast(action === "approve" ? `Approved ${plural(ok, "task")} → done` : `Sent back ${plural(ok, "task")} → todo`)
    if (failed.length) toast(failed.join(" · "))
  }

  return (
    <div
      role="toolbar"
      aria-label={`${rows.length} selected`}
      className="sticky bottom-3 z-20 mx-3 mt-3 flex flex-col gap-2 rounded-lg border border-border2 bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] backdrop-blur-sm animate-panel-in sm:mx-5"
    >
      {note !== null ? (
        <form
          className="flex flex-col gap-2 p-1"
          onSubmit={(e) => { e.preventDefault(); if (note.trim()) void review("send-back", sendable, note) }}
        >
          <label htmlFor="bulk-note" className="text-xs text-muted">
            Send back {plural(sendable.length, "task")} to todo with one note. The agent reads it first.
          </label>
          <textarea
            id="bulk-note"
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setNote(null) } }}
            placeholder="What needs to change?"
            className="w-full resize-none rounded-md border border-border bg-bg px-2.5 py-2 text-sm text-txt placeholder:text-muted focus:border-accent/60 focus:outline-hidden"
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || !note.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber/40 bg-amber/15 px-2.5 text-xs text-amber transition-colors hover:bg-amber/25 disabled:opacity-40">
              <CornerUpLeft className="size-3.5" aria-hidden /> Send back {sendable.length}
            </button>
            <button type="button" onClick={() => setNote(null)} disabled={busy} className="text-xs text-muted hover:text-txt">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="shrink-0 px-2 font-mono text-xs text-txt tabular-nums">{rows.length} selected</span>
          <span className="mx-1 h-4 w-px shrink-0 bg-border2" aria-hidden />
          <button type="button" className={BTN} disabled={demo || busy || !withChecks.length} onClick={() => void tick(true)} title="Tick every manual check of the selected tasks">
            <ListChecks className="size-3.5 text-teal" aria-hidden /> Tick all
          </button>
          <button type="button" className={BTN} disabled={demo || busy || !withChecks.length} onClick={() => void tick(false)}>
            <ListX className="size-3.5 text-muted" aria-hidden /> Untick all
          </button>
          <button type="button" className={BTN} disabled={demo || busy || !inReview.length} onClick={() => void review("approve", inReview)} title="Only tasks in review can be approved">
            <Check className="size-3.5 text-teal" aria-hidden /> Approve{inReview.length ? ` ${inReview.length}` : ""}
          </button>
          <button type="button" className={BTN} disabled={demo || busy || !sendable.length} onClick={() => setNote("")} title="Tasks in review or done">
            <CornerUpLeft className="size-3.5 text-amber" aria-hidden /> Send back{sendable.length ? ` ${sendable.length}` : ""}…
          </button>
          <button type="button" onClick={onClear} aria-label="Clear selection" title="Clear selection (Esc)" className={`${BTN} ml-auto px-2 text-muted`}>
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
