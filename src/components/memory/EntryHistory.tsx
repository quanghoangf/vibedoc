"use client"

import { useState } from "react"
import { ChevronRight, GitCommitHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import type { FileCommit, FileHistory } from "@/lib/core"
import { tNow, useT } from "@/context/LanguageContext"

/**
 * How an entry changed over time (R053): the commits that touched its file, from git.
 * Collapsed by default; nothing is fetched until it is opened. A row shows that version read-only.
 */
export function EntryHistory({ entryId }: { entryId: string }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<FileHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<{ commit: FileCommit; text: string } | null>(null)
  const base = `/api/memory/history${rootParam}&entry=${encodeURIComponent(entryId)}`

  const get = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? tNow("board.requestFailed", { status: res.status }))
    return body as T
  }

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || data) return
    try {
      setData(await get<FileHistory>(base))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const show = async (commit: FileCommit) => {
    try {
      const { text } = await get<{ text: string }>(`${base}&sha=${commit.sha}`)
      setVersion({ commit, text })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section aria-label={t("memory.history")} className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1 rounded text-xs font-semibold text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronRight className={cn("size-3.5 text-muted transition-transform", open && "rotate-90")} aria-hidden />
        {t("memory.history")}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          {!data && !error && <p className="text-xs text-muted">{t("memory.loadingHistory")}</p>}
          {data?.reason === "no-git" && <p className="text-xs text-muted">{t("memory.needsGit")}</p>}
          {data && !data.reason && !data.history.length && !data.uncommitted && (
            <p className="text-xs text-muted">{t("memory.notCommitted")}</p>
          )}
          {data && (data.uncommitted || data.history.length > 0) && (
            <ul className="flex flex-col">
              {data.uncommitted && (
                <li className="flex items-center gap-2 px-2 py-1 text-xs text-muted">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden /> {t("memory.uncommitted")}
                </li>
              )}
              {data.history.map((c) => (
                <li key={c.sha}>
                  <button
                    type="button"
                    onClick={() => show(c)}
                    aria-current={version?.commit.sha === c.sha ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent",
                      version?.commit.sha === c.sha && "bg-surface2",
                    )}
                  >
                    <GitCommitHorizontal className="size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="shrink-0 font-mono text-[11px] text-muted">{c.date.slice(0, 10)}</span>
                    <span data-user-content className="min-w-0 flex-1 truncate text-txt">{c.subject}</span>
                    <span className="shrink-0 text-muted">{c.author}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {version && (
            <div className="rounded-md border border-border bg-bg">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">
                <span>{t("memory.readOnly", { sha: version.commit.sha.slice(0, 7), date: version.commit.date.slice(0, 10) })}</span>
                <button type="button" onClick={() => setVersion(null)} aria-label={t("memory.closeVersion")} className="rounded p-0.5 hover:text-txt">
                  <X className="size-3.5" />
                </button>
              </div>
              <pre data-user-content className="max-h-72 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-txt">{version.text}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
