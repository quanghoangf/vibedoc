"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileDiff, GitCommit, GitMerge, GitPullRequest, Trash2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { CopyCommand } from "@/components/shared/CopyCommand"
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
 * T564: Open PR and Merge into the base, each after a confirm naming the exact commands; after a merge, Remove is offered.
 */
export function WorkerFinish({ chatId, worker }: { chatId: string; worker: Worker }) {
  const { t, tn } = useT()
  const { rootParam } = useApp()
  const [diff, setDiff] = useState<WorkerDiff | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [action, setAction] = useState<GitAction | null>(null)
  // set at once, before worker_updated brings mergedAt
  const [justMerged, setJustMerged] = useState(false)
  const merged = justMerged || !!worker.mergedAt
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
  }, [chatId, rootParam, turns, worker.phase, worker.mergedAt, t])

  return (
    <section data-worker-finish aria-label={t("workers.finishTitle", { branch: worker.branch })} className="rounded-md border border-border">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface2 px-3 py-2 text-xs">
        <span className="font-medium text-txt">{t("workers.finishTitle", { branch: worker.branch })}</span>
        {diff && <span className="text-muted">{tn("workers.finishCommits", diff.commits.length)} · {tn("workers.finishFiles", diff.files.length)}</span>}
        {worker.prUrl && (
          <a href={worker.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
            <ExternalLink className="size-3.5" aria-hidden />
            {t("workers.prLink")}
          </a>
        )}
        <span className="ml-auto" />
        {diff && diff.commits.length > 0 && !merged && (
          <>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setAction("pr")}>
              <GitPullRequest className="size-3.5" aria-hidden />
              {t("workers.openPr")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setAction("merge")}>
              <GitMerge className="size-3.5" aria-hidden />
              {t("workers.merge", { base: worker.base })}
            </Button>
          </>
        )}
        {!worker.removedAt && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs hover:text-danger" onClick={() => setConfirming(true)}>
            <Trash2 className="size-3.5" aria-hidden />
            {t("workers.remove")}
          </Button>
        )}
      </header>
      <div className="flex flex-col gap-3 px-3 py-2 text-xs">
        {!diff && !error && <p className="text-muted">{t("workers.finishLoading")}</p>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        {merged && <p className="text-txt">{t("workers.merged", { base: worker.base })}</p>}
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
      {confirming && <RemoveDialog chatId={chatId} worker={worker} merged={merged} unmerged={!merged && (diff?.commits.length ?? 0) > 0} onClose={() => setConfirming(false)} />}
      {action && (
        <GitActionDialog
          key={action}
          kind={action}
          chatId={chatId}
          worker={worker}
          onClose={() => setAction(null)}
          onSwitch={setAction}
          // offer Remove once the branch is in the base
          onMerged={() => { setJustMerged(true); setAction(null); if (!worker.removedAt) setConfirming(true) }}
        />
      )}
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

function RemoveDialog({ chatId, worker, merged, unmerged, onClose }: { chatId: string; worker: Worker; merged: boolean; unmerged: boolean; onClose: () => void }) {
  const { t } = useT()
  const { rootParam } = useApp()
  // merged: its commits are in the base, so the branch can go too
  const [deleteBranch, setDeleteBranch] = useState(merged)
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

type GitAction = "pr" | "merge"

/** The argv src/lib/git-actions.ts runs (it imports child_process, so the client can't import it). */
const gitCommands = (kind: GitAction, w: Worker) => kind === "merge"
  ? [`git merge --no-ff --no-edit ${w.branch}`]
  : [`git push -u origin ${w.branch}`, `gh pr create --fill --base ${w.base} --head ${w.branch}`]

function GitActionDialog({ kind, chatId, worker, onClose, onSwitch, onMerged }: {
  kind: GitAction
  chatId: string
  worker: Worker
  onClose: () => void
  onSwitch: (kind: GitAction) => void
  onMerged: () => void
}) {
  const { t } = useT()
  const { rootParam } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // refused: the commands to run yourself (no gh, not logged in), or a merge that should be a PR
  const [commands, setCommands] = useState<string[] | null>(null)
  const [offerPr, setOfferPr] = useState(false)

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/workers/${kind}${rootParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: chatId }),
      })
      const d = await res.json().catch(() => null) as { error?: string; commands?: string[]; offerPr?: boolean } | null
      if (!res.ok) {
        setError(d?.error ?? t("board.requestFailed", { status: res.status }))
        setCommands(d?.commands ?? null)
        setOfferPr(!!d?.offerPr)
        return
      }
      if (kind === "merge") { onMerged(); return }
      toast(t("workers.prOpened"))
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const done = !!commands || offerPr
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose() }}>
      <DialogContent className="max-w-lg border-border bg-surface text-txt shadow-xl shadow-black/20">
        <DialogTitle className="text-sm font-semibold text-txt">
          {kind === "merge" ? t("workers.mergeTitle", { branch: worker.branch, base: worker.base }) : t("workers.prTitle")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted">
          {kind === "merge" ? t("workers.mergeLead", { base: worker.base }) : t("workers.prLead")}
        </DialogDescription>
        {!commands && (
          <pre aria-label={t("workers.commands")} className="overflow-x-auto rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-xs text-txt">
            {gitCommands(kind, worker).join("\n")}
          </pre>
        )}
        {kind === "merge" && !done && <p className="text-xs text-muted">{t("workers.mergeNote")}</p>}
        {error && <p role="alert" className="break-words text-xs text-danger">{error}</p>}
        {commands && <div className="flex flex-col gap-2">{commands.map((c) => <CopyCommand key={c} command={c} />)}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>{done ? t("workers.close") : t("workers.cancel")}</Button>
          {offerPr && <Button type="button" size="sm" onClick={() => onSwitch("pr")}>{t("workers.mergeInsteadPr")}</Button>}
          {!done && (
            <Button type="button" size="sm" onClick={() => void go()} disabled={busy}>
              {kind === "merge" ? (busy ? t("workers.merging") : t("workers.mergeConfirm")) : (busy ? t("workers.prOpening") : t("workers.prConfirm"))}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
