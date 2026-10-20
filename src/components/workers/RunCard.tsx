"use client"

import { useEffect, useState } from "react"
import { Bot, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import { useApp } from "@/context/AppContext"
import type { WorkerTools } from "@/components/settings/WorkersSettings"
import type { Attach } from "@/lib/chats"
import { WORKER_ALLOWED, WORKER_DENIED } from "@/lib/worker-args"

/** What a run would do (ADR-007 decision 2). T555 builds it client-side ("new" only); T561 gets it from the server. */
export interface RunProposal {
  target: Attach
  mode: "new"
  branch: string
  base: string
  allowed: string[]
  denied: string[]
  /** Not built yet (T567): undefined shows "No limit yet" */
  budget?: string
}

export interface RunValues { branch: string; base: string }

/** The proposal T555 offers for an epic. Branch mirrors defaultBranch() in worktrees.ts (server-only: node imports). */
export function newWorktreeProposal(target: Attach): RunProposal {
  return { target, mode: "new", branch: `vibedoc/${target.id}`, base: "HEAD", allowed: WORKER_ALLOWED, denied: WORKER_DENIED }
}

/** The one card for starting work: target, mode, branch, base, tools and budget. Nothing starts before Accept. */
export function RunCard({ proposal, busy, error, onAccept, onCancel }: {
  proposal: RunProposal
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
  onCancel?: () => void
}) {
  const { t } = useT()
  const [branch, setBranch] = useState(proposal.branch)
  const [base, setBase] = useState(proposal.base)
  const field = "w-full rounded-md border border-border bg-surface2 px-2.5 py-1.5 font-mono text-xs text-txt focus:border-accent/60 focus:outline-hidden"
  return (
    <form
      aria-label={t("workers.runCardTitle", { id: proposal.target.id })}
      onSubmit={(e) => { e.preventDefault(); if (branch.trim() && base.trim()) onAccept({ branch: branch.trim(), base: base.trim() }) }}
      className="flex flex-col gap-3 text-sm"
    >
      <p className="inline-flex items-center gap-1.5 text-xs text-muted">
        <GitBranch className="size-3.5" aria-hidden /> {t("workers.modeNew")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("workers.branch")}
          <input value={branch} onChange={(e) => setBranch(e.target.value)} disabled={busy} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("workers.base")}
          <input value={base} onChange={(e) => setBase(e.target.value)} disabled={busy} className={field} />
        </label>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">{t("workers.tools")}</dt>
        <dd className="flex flex-wrap gap-1">{proposal.allowed.map((a) => <code key={a} className="rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] text-muted">{a}</code>)}</dd>
        <dt className="text-muted">{t("workers.denied")}</dt>
        <dd className="flex flex-wrap gap-1">{proposal.denied.map((a) => <code key={a} className="rounded-sm border border-danger/30 px-1 font-mono text-[10px] text-danger">{a}</code>)}</dd>
        <dt className="text-muted">{t("workers.budget")}</dt>
        <dd className="text-txt">{proposal.budget ?? t("workers.noBudget")}</dd>
      </dl>
      {error && <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{t("workers.startFailed", { error })}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>{t("workers.cancel")}</Button>}
        <Button type="submit" size="sm" disabled={busy || !branch.trim() || !base.trim()} className="bg-accent text-accent-fg hover:bg-accent/90">
          <Bot /> {busy ? t("workers.starting") : t("workers.accept")}
        </Button>
      </div>
    </form>
  )
}

/** RunCard in a dialog (the epic sheet's "Work with agent"). Shows the project's allowlist (GET /api/workers, T557). */
export function RunCardDialog({ proposal, open, onOpenChange, busy, error, onAccept }: {
  proposal: RunProposal
  open: boolean
  onOpenChange: (open: boolean) => void
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
}) {
  const { t } = useT()
  const { rootParam } = useApp()
  const [tools, setTools] = useState<WorkerTools | null>(null)
  useEffect(() => {
    if (!open) return
    fetch(`/api/workers${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch((e) => { console.warn("[vibedoc] could not read worker settings:", e); return null })
      // unreadable: the defaults, which is what the server falls back to as well
      .then((w: WorkerTools | null) => setTools(w ?? { allowed: proposal.allowed, denied: proposal.denied, maxRunning: 0, env: [] }))
  }, [open, rootParam, proposal.allowed, proposal.denied])
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="max-w-lg bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">{t("workers.runCardTitle", { id: proposal.target.id })}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("workers.runCardLead")}</DialogDescription>
        {open && tools && <RunCard proposal={{ ...proposal, allowed: tools.allowed, denied: tools.denied }} busy={busy} error={error} onAccept={onAccept} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
