"use client"

import { useState } from "react"
import { Bot, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import type { RunProposal } from "@/lib/run-proposal"

export interface RunValues { branch: string; base: string }

/** The one card for starting work: target, mode, branch, base, tools and budget. Nothing starts before Accept. */
export function RunCard({ proposal, errors = [], busy, error, onAccept, onCancel }: {
  proposal: RunProposal
  /** validateRunProposal's reasons (T561): shown, and Accept is off */
  errors?: string[]
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
  onCancel?: () => void
}) {
  const { t } = useT()
  const [branch, setBranch] = useState(proposal.branch)
  const [base, setBase] = useState(proposal.base)
  const existing = proposal.mode === "existing"
  const blocked = errors.length > 0 || (existing && !!proposal.running)
  const field = "w-full rounded-md border border-border bg-surface2 px-2.5 py-1.5 font-mono text-xs text-txt focus:border-accent/60 focus:outline-hidden"
  return (
    <form
      aria-label={t("workers.runCardTitle", { id: proposal.target.id })}
      onSubmit={(e) => { e.preventDefault(); if (branch.trim() && base.trim()) onAccept({ branch: branch.trim(), base: base.trim() }) }}
      className="flex flex-col gap-3 text-sm"
    >
      <p className="inline-flex items-center gap-1.5 text-xs text-muted">
        <GitBranch className="size-3.5" aria-hidden /> {existing ? t("workers.modeExisting", { branch: proposal.branch }) : t("workers.modeNew")}
      </p>
      {existing && proposal.running && <p className="text-xs text-txt">{proposal.currentTask ? t("workers.workerBusyOn", { id: proposal.currentTask }) : t("workers.workerBusy")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("workers.branch")}
          <input value={branch} onChange={(e) => setBranch(e.target.value)} disabled={busy} readOnly={existing} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("workers.base")}
          <input value={base} onChange={(e) => setBase(e.target.value)} disabled={busy} readOnly={existing} className={field} />
        </label>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">{t("workers.tools")}</dt>
        <dd className="flex flex-wrap gap-1">{proposal.allowedTools.map((a) => <code key={a} className="rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] text-muted">{a}</code>)}</dd>
        <dt className="text-muted">{t("workers.denied")}</dt>
        <dd className="flex flex-wrap gap-1">{proposal.denied.map((a) => <code key={a} className="rounded-sm border border-danger/30 px-1 font-mono text-[10px] text-danger">{a}</code>)}</dd>
        <dt className="text-muted">{t("workers.budget")}</dt>
        <dd className="text-txt">{proposal.budget ? t("workers.budgetValue", { turns: proposal.budget.maxTurns, min: proposal.budget.timeoutMin }) : t("workers.noBudget")}</dd>
      </dl>
      {errors.map((e) => <p key={e} role="alert" className="whitespace-pre-wrap text-xs text-danger">{e}</p>)}
      {error && <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{t("workers.startFailed", { error })}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>{t("workers.cancel")}</Button>}
        <Button type="submit" size="sm" disabled={busy || blocked || !branch.trim() || !base.trim()} className="bg-accent text-accent-fg hover:bg-accent/90">
          <Bot /> {busy ? t("workers.starting") : existing ? t("workers.acceptExisting") : t("workers.accept")}
        </Button>
      </div>
    </form>
  )
}

/** RunCard in a dialog (the epic sheet's "Work with agent"). `proposal` null = still loading (GET /api/workers/propose). */
export function RunCardDialog({ target, proposal, errors, open, onOpenChange, busy, error, onAccept }: {
  target: string
  proposal: RunProposal | null
  errors?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="max-w-lg bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">{t("workers.runCardTitle", { id: target })}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("workers.runCardLead")}</DialogDescription>
        {open && (proposal
          ? <RunCard key={`${proposal.mode}-${proposal.workerId ?? proposal.branch}`} proposal={proposal} errors={errors} busy={busy} error={error} onAccept={onAccept} onCancel={() => onOpenChange(false)} />
          : error ? <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{error}</p>
          : <p role="status" className="text-xs text-muted">{t("workers.proposing")}</p>)}
      </DialogContent>
    </Dialog>
  )
}
