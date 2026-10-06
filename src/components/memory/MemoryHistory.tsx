"use client"

import { useEffect, useMemo, useState } from "react"
import { History, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { lineDiff, visibleHunks } from "@/lib/diff"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { parseOwner } from "@/lib/owner"
import { tNow, useFormat, useT } from "@/context/LanguageContext"
import type { MemoryVersion } from "@/lib/core"
import { useApp } from "@/context/AppContext"

interface MemoryHistoryProps {
  /** null while loading */
  versions: MemoryVersion[] | null
  /** The MEMORY.md on disk now (the diff's other side) */
  current: string
  rootParam: string
  /** ?version= */
  selectedId: string | null
  onSelect: (id: string | null) => void
  onClose: () => void
  onRestore: (version: MemoryVersion) => Promise<void>
}

/**
 * Saved MEMORY.md versions (R045), newest first, in place of the rendered handoff.
 * A row shows a line diff from the current file to that version and a Restore button.
 */
export function MemoryHistory({ versions, current, rootParam, selectedId, onSelect, onClose, onRestore }: MemoryHistoryProps) {
  const { demo } = useApp()
  const f = useFormat()
  const { t, tn } = useT()
  const [loaded, setLoaded] = useState<{ id: string; content: string } | { id: string; error: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const selected = versions?.find((v) => v.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    let live = true
    fetch(`/api/memory/versions${rootParam}&id=${encodeURIComponent(selectedId)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? tNow("board.requestFailed", { status: r.status }))
        if (live) setLoaded({ id: selectedId, content: String(body.content ?? "") })
      })
      .catch((e) => { if (live) setLoaded({ id: selectedId, error: e instanceof Error ? e.message : String(e) }) })
    return () => { live = false }
  }, [selectedId, rootParam])

  // Esc closes the pane, unless something inside (a field, a menu) already handled it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const version = loaded && loaded.id === selectedId ? loaded : null
  const hunks = useMemo(() => (version && "content" in version ? visibleHunks(lineDiff(current, version.content)) : []), [version, current])
  const added = hunks.filter((h) => typeof h !== "number" && h.op === "+").length
  const removed = hunks.filter((h) => typeof h !== "number" && h.op === "-").length
  const changed = added + removed > 0

  const restore = async () => {
    if (!selected) return
    setRestoring(true)
    try { await onRestore(selected) } finally { setRestoring(false) }
  }

  return (
    <section aria-label={t("memory.memoryHistory")} className="flex flex-col gap-3">
      {!versions && <p className="text-sm text-muted">{t("memory.loadingHistory")}</p>}
      {versions?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
          {t("memory.noVersions")}
        </div>
      )}
      {versions && versions.length > 0 && (
        <ul className="flex flex-col rounded-xl border border-border bg-surface p-1">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(v.id === selectedId ? null : v.id)}
                aria-current={v.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent",
                  v.id === selectedId && "bg-surface2",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <History className="size-3.5 shrink-0 text-muted" aria-hidden />
                  <time dateTime={v.at} title={f.dateTime(v.at)} className="shrink-0 font-mono text-[11px] text-muted">{f.timeAgo(v.at)}</time>
                  <OwnerChip owner={parseOwner(v.actor)} className="shrink-0" />
                  <span className="shrink-0 font-mono text-[11px] text-muted">{v.reason === "restore" ? t("memory.beforeRestore") : t("memory.beforeUpdate")}</span>
                </span>
                <span data-user-content={v.excerpt ? true : undefined} className={cn("block truncate pl-5.5", v.excerpt ? "text-txt" : "italic text-muted")}>{v.excerpt || t("memory.noHandoff")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId && versions && !selected && (
        <p role="alert" className="text-xs text-muted">{t("memory.versionGone", { id: selectedId })}</p>
      )}
      {selected && (
        <div className="overflow-hidden rounded-xl border border-border bg-bg">
          <div className="flex items-start gap-2 border-b border-border bg-surface2 px-3 py-1.5 font-mono text-[11px] text-muted">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span title={f.dateTime(selected.at)}>{selected.at.slice(0, 16).replace("T", " ")}Z</span>
              <span><span className="text-danger">{t("memory.diffNow")}</span> <span className="text-teal">{t("memory.diffThis")}</span></span>
              {version && "content" in version && (
                <span className="ml-auto"><span className="text-teal">+{added}</span> <span className="text-danger">−{removed}</span></span>
              )}
            </div>
            <button type="button" onClick={() => onSelect(null)} aria-label={t("memory.closeVersion")} className="shrink-0 rounded p-0.5 outline-none hover:text-txt focus-visible:ring-2 focus-visible:ring-accent">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="max-h-96 overflow-auto font-mono text-[11px] leading-5">
            {!version && <div className="px-3 py-1 text-muted">{t("memory.loadingDiff")}</div>}
            {version && "error" in version && <div role="alert" className="px-3 py-1 text-danger">{version.error}</div>}
            {version && "content" in version && !changed && <div className="px-3 py-1 text-muted">{t("memory.sameAsCurrent")}</div>}
            {hunks.map((h, i) =>
              typeof h === "number" ? (
                <div key={i} className="bg-surface2/50 px-3 text-muted">{tn("roadmap.unchangedLines", h)}</div>
              ) : (
                <div
                  key={i}
                  data-user-content
                  className={cn(
                    "whitespace-pre-wrap break-words px-3",
                    h.op === "+" && "bg-teal/10 text-teal",
                    h.op === "-" && "bg-danger/10 text-danger",
                  )}
                >
                  {h.op === "-" ? "−" : h.op}{" "}{h.text || " "}
                </div>
              ),
            )}
          </div>
          {!demo && <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={restore}
              disabled={restoring || !version || "error" in version || !changed}
              className="h-7 shrink-0 whitespace-nowrap rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg outline-none hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50"
            >
              {restoring ? t("memory.restoring") : t("memory.restoreVersion")}
            </button>
            <span className="text-[11px] text-muted">{t("memory.restoreHint")}</span>
          </div>}
        </div>
      )}
    </section>
  )
}
