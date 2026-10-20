"use client"

import { useEffect, useState } from "react"
import { FileDiff, GitCommit, Trash2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { Worker, WorkerPhase } from "@/lib/chats"
import type { WorkerDiff } from "@/lib/core"

/** Phases a run has ended in: the finish panel shows and Remove is allowed (POST /api/workers/remove refuses the rest). */
export const FINISHED: WorkerPhase[] = ["ended", "stopped", "failed"]

/** A file's patch opens by itself when it is this short; longer ones stay collapsed. */
const OPEN_MAX_LINES = 40

/**
 * T563: at the end of a finished worker's chat: its branch's commits and per-file diff since the base, and Remove
 * worktree (confirms: a worktree can't be restored, unlike the undo toasts elsewhere).
 */
export function WorkerFinish({ chatId, worker }: { chatId: string; worker: Worker }) {
  const { t, tn } = useT()
  const { rootParam } = useApp()
  const [diff, setDiff] = useState<WorkerDiff | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const turns = worker.turns.length

  useEffect(() => {
    let live = true
    fetch(`/api/workers/diff${rootParam}&id=${encodeURIComponent(chatId)}`)
      .then(async (res) => {
        const d = await res.json().catch(() => null) as (WorkerDiff & { error?: string }) | null
        if (!live) return
        if (!res.ok || !d?.files) { setError(d?.error ?? t("board.requestFailed", { status: res.status })); setDiff(null) }
        else { setDiff(d); setError(null) }
      })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [chatId, rootParam, turns, worker.phase, t])

  return (
    <section data-worker-finish aria-label={t("workers.finishTitle", { branch: worker.branch })} className="rounded-md border border-border">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface2 px-3 py-2 text-xs">
        <span className="font-medium text-txt">{t("workers.finishTitle", { branch: worker.branch })}</span>
        {diff && <span className="text-muted">{tn("workers.finishCommits", diff.commits.length)} · {tn("workers.finishFiles", diff.files.length)}</span>}
        {!worker.removedAt && (
          <Button type="button" variant="outline" size="sm" className="ml-auto h-7 gap-1 text-xs hover:text-danger" onClick={() => setConfirming(true)}>
            <Trash2 className="size-3.5" aria-hidden />
            {t("workers.remove")}
          </Button>
        )}
      </header>
      <div className="flex flex-col gap-3 px-3 py-2 text-xs">
        {!diff && !error && <p className="text-muted">{t("workers.finishLoading")}</p>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        {diff && diff.commits.length === 0 && <p className="text-muted">{t("workers.finishNoChanges", { base: worker.base })}</p>}
        {diff && diff.commits.length > 0 && (
          <ul aria-label={tn("workers.finishCommits", diff.commits.length)} className="flex flex-col gap-0.5">
            {diff.commits.map((c) => (
              <li key={c.sha} className="flex min-w-0 items-center gap-2">
                <GitCommit className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="font-mono text-muted">{c.sha}</span>
                <span data-user-content className="truncate text-txt">{c.subject}</span>
              </li>
            ))}
          </ul>
        )}
        {diff && diff.files.length > 0 && (
          <ul aria-label={tn("workers.finishFiles", diff.files.length)} className="flex flex-col gap-1">
            {diff.files.map((f) => <FilePatch key={f.path} file={f} />)}
          </ul>
        )}
        {diff && diff.cut > 0 && <p className="text-muted">{t("workers.finishCut", { n: diff.cut })}</p>}
      </div>
      {confirming && <RemoveDialog chatId={chatId} worker={worker} unmerged={(diff?.commits.length ?? 0) > 0} onClose={() => setConfirming(false)} />}
    </section>
  )
}

function FilePatch({ file }: { file: WorkerDiff["files"][number] }) {
  const { t } = useT()
  const lines = file.patch ? file.patch.split("\n") : []
  // the header lines (diff --git, index, ---/+++) say nothing the row doesn't
  const body = lines.slice(Math.max(0, lines.findIndex((l) => l.startsWith("@@"))))
  return (
    <li className="overflow-hidden rounded-sm border border-border">
      <details open={body.length > 0 && body.length <= OPEN_MAX_LINES}>
        <summary className="flex cursor-pointer items-center gap-2 bg-surface2/50 px-2 py-1">
          <FileDiff className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span data-user-content className="min-w-0 truncate font-mono text-txt">{file.path}</span>
          {file.added === null ? <span className="text-muted">{t("workers.finishBinary")}</span> : (
            <>
              <span className="font-mono text-[10px] text-teal-400">+{file.added}</span>
              <span className="font-mono text-[10px] text-red-400">-{file.removed}</span>
            </>
          )}
        </summary>
        {body.length > 0 && (
          <div className="max-h-72 overflow-auto font-mono text-[11px] leading-5">
            {body.map((l, i) => (
              <div
                key={i}
                data-user-content
                className={cn(
                  "whitespace-pre-wrap break-words px-2",
                  l.startsWith("@@") && "bg-surface2/50 text-muted",
                  l.startsWith("+") && "bg-teal-500/10 text-teal-300",
                  l.startsWith("-") && "bg-red-500/10 text-red-300",
                )}
              >
                {l || " "}
              </div>
            ))}
          </div>
        )}
      </details>
    </li>
  )
}

function RemoveDialog({ chatId, worker, unmerged, onClose }: { chatId: string; worker: Worker; unmerged: boolean; onClose: () => void }) {
  const { t } = useT()
  const { rootParam } = useApp()
  const [deleteBranch, setDeleteBranch] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/workers/remove${rootParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: chatId, discard: dirty, deleteBranch }),
      })
      const d = await res.json().catch(() => null) as { error?: string; dirty?: boolean; branchError?: string } | null
      if (res.status === 409 && d?.dirty) { setDirty(true); return }
      if (!res.ok) throw new Error(d?.error ?? t("board.requestFailed", { status: res.status }))
      toast(d?.branchError ? t("workers.removedBranchKept", { error: d.branchError }) : t("workers.removed"))
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose() }}>
      <DialogContent className="max-w-md border-border bg-surface text-txt shadow-xl shadow-black/20">
        <DialogTitle className="text-sm font-semibold text-txt">{t("workers.removeTitle")}</DialogTitle>
        <DialogDescription className="break-words text-xs text-muted">{t("workers.removeLead", { dir: worker.dir })}</DialogDescription>
        {dirty && <p role="alert" className="text-xs text-amber">{t("workers.removeDirty")}</p>}
        <label className="flex items-start gap-2 text-xs text-txt">
          <input type="checkbox" checked={deleteBranch} onChange={(e) => setDeleteBranch(e.target.checked)} className="mt-0.5" />
          <span>
            {t("workers.removeDeleteBranch", { branch: worker.branch })}
            {deleteBranch && unmerged && <span className="block text-amber">{t("workers.removeUnmerged")}</span>}
          </span>
        </label>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>{t("workers.cancel")}</Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => void remove()} disabled={busy}>
            {busy ? t("workers.removing") : dirty ? t("workers.removeDiscard") : t("workers.removeConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
