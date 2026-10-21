"use client"

import { useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, ChevronRight, GitBranch, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import { useApp } from "@/context/AppContext"
import type { MessageKey } from "@/i18n"
import type { Attach } from "@/lib/chats"
import type { RunProposal, RunRefusal } from "@/lib/run-proposal"

export interface RunValues { branch: string; base: string }

const REFUSAL_KEY: Record<RunRefusal["code"], MessageKey> = {
  "not-found": "workers.refNotFound",
  horizon: "workers.refHorizon",
  "nothing-left": "workers.refNothingLeft",
  "in-progress": "workers.refInProgress",
  "has-worker": "workers.refHasWorker",
  "branch-required": "workers.refBranchRequired",
  "branch-exists": "workers.refBranchExists",
  "base-required": "workers.refBaseRequired",
  limit: "workers.refLimit",
  "no-worker": "workers.refNoWorker",
  "other-target": "workers.refOtherTarget",
  "worker-running": "workers.refWorkerRunning",
}

/** The one card for starting work: target, mode, branch, base, budget and tools. Nothing starts before Accept. */
export function RunCard({ proposal, errors = [], refusals, busy, error, onAccept, onCancel, cancelLabel, onOpenWorker }: {
  proposal: RunProposal
  /** validateRunProposal's reasons (T561): shown when `refusals` is missing, and Accept is off */
  errors?: string[]
  /** The same reasons as data (runRefusals): shown in the UI's language, with a way out where there is one */
  refusals?: RunRefusal[]
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
  onCancel?: () => void
  /** The cancel button's text (the orchestrator chat's card says Reject) */
  cancelLabel?: string
  /** A refusal that names a worker links to its chat */
  onOpenWorker?: (workerId: string) => void
}) {
  const { t } = useT()
  const [branch, setBranch] = useState(proposal.branch)
  const [base, setBase] = useState(proposal.base)
  const existing = proposal.mode === "existing"
  const blocked = (refusals?.length ?? errors.length) > 0 || (existing && !!proposal.running)
  const field = "w-full rounded-md border border-border bg-surface2 px-2.5 py-1.5 font-mono text-xs text-txt focus:border-accent/60 focus:outline-hidden"
  const chip = "rounded-sm border px-1 font-mono text-[11px]"
  const workerLink = (id: string) => onOpenWorker && (
    <button type="button" onClick={() => onOpenWorker(id)} className="ml-1 text-accent underline-offset-2 hover:underline">{t("workers.openWorker")}</button>
  )
  return (
    <form
      aria-label={t("workers.runCardTitle", { id: proposal.target.id })}
      onSubmit={(e) => { e.preventDefault(); if (branch.trim() && base.trim()) onAccept({ branch: branch.trim(), base: base.trim() }) }}
      className="flex flex-col gap-3 text-sm"
    >
      <p className="inline-flex items-center gap-1.5 text-xs text-muted">
        <GitBranch className="size-3.5" aria-hidden /> {existing ? t("workers.modeExisting", { branch: proposal.branch }) : t("workers.modeNew")}
      </p>
      {existing && proposal.running && (
        <p className="text-xs text-txt">
          {proposal.currentTask ? t("workers.workerBusyOn", { id: proposal.currentTask }) : t("workers.workerBusy")}
          {proposal.workerId && workerLink(proposal.workerId)}
        </p>
      )}
      {proposal.waitingOn && (
        <p className="flex items-start gap-1.5 text-xs text-amber">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("workers.waitingOn", { list: proposal.waitingOn.map((d) => `${d.id} (${d.status})`).join(", ") })}
        </p>
      )}
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
      <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted">{t("workers.budget")}</dt>
        <dd className="font-medium text-txt">{proposal.budget ? t("workers.budgetValue", { turns: proposal.budget.maxTurns, min: proposal.budget.timeoutMin }) : t("workers.noBudget")}</dd>
        {proposal.permission && (
          <>
            <dt className="text-muted">{t("workers.permissionMode")}</dt>
            <dd className={proposal.permission.fallback ? "font-medium text-amber" : "font-medium text-txt"} data-permission-mode={proposal.permission.mode}>
              {proposal.permission.fallback ? t("workers.modeFallback") : t(proposal.permission.mode === "auto" ? "workers.modeAuto" : "workers.modeAcceptEdits")}
            </dd>
          </>
        )}
        <dt className="text-muted">{t("workers.toolsRow")}</dt>
        <dd>
          {/* the full allowlist is one click away: the summary is what changes run to run */}
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-txt hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3.5 text-muted transition-transform duration-(--duration-fast) group-open:rotate-90" aria-hidden />
              {t("workers.toolsSummary", { allowed: proposal.allowedTools.length, denied: proposal.denied.length })}
            </summary>
            <ul aria-label={t("workers.tools")} className="mt-1.5 flex flex-wrap gap-1">
              {proposal.allowedTools.map((a) => <li key={a}><code className={`${chip} border-border bg-surface2 text-muted`}>{a}</code></li>)}
            </ul>
            <ul aria-label={t("workers.denied")} className="mt-1 flex flex-wrap gap-1">
              {proposal.denied.map((a) => <li key={a}><code className={`${chip} border-danger/30 text-danger`}>{a}</code></li>)}
            </ul>
          </details>
        </dd>
      </dl>
      <p className="text-[11px] leading-relaxed text-muted">{t("workers.notSandbox")}</p>
      {refusals
        ? refusals.map((r) => (
          <p key={r.text} role="alert" className="text-xs text-danger">
            {t(REFUSAL_KEY[r.code], r.vars)}
            {r.workerId && workerLink(r.workerId)}
            {r.code === "limit" && <Link href="/settings?tab=workers" className="ml-1 text-accent underline-offset-2 hover:underline">{t("workers.openSettings")}</Link>}
          </p>
        ))
        : errors.map((e) => <p key={e} role="alert" className="whitespace-pre-wrap text-xs text-danger">{e}</p>)}
      {error && <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{t("workers.startFailed", { error })}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>{cancelLabel ?? t("workers.cancel")}</Button>}
        <Button type="submit" size="sm" autoFocus={!blocked} disabled={busy || blocked || !branch.trim() || !base.trim()} className="bg-accent text-accent-fg hover:bg-accent/90 disabled:bg-surface2 disabled:text-muted disabled:opacity-100">
          <Bot /> {busy ? t("workers.starting") : existing ? t("workers.acceptExisting") : t("workers.accept")}
        </Button>
      </div>
    </form>
  )
}

/** RunCard in a dialog (the epic sheet's "Work with agent"). `proposal` null = still loading (GET /api/workers/propose). */
export function RunCardDialog({ target, proposal, errors, refusals, open, onOpenChange, busy, error, onAccept, onOpenWorker, returnFocus }: {
  target: string
  /** Focused again on close (the button that opened it: the card opens after a fetch, so Radix's own return finds nothing) */
  returnFocus?: () => HTMLElement | null
  proposal: RunProposal | null
  errors?: string[]
  refusals?: RunRefusal[]
  onOpenWorker?: (workerId: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  busy?: boolean
  error?: string | null
  onAccept: (v: RunValues) => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="max-w-lg bg-surface border-border text-txt" onCloseAutoFocus={(e) => { const el = returnFocus?.(); if (el?.isConnected) { e.preventDefault(); el.focus() } }}>
        <DialogTitle className="text-sm font-semibold text-txt">{t("workers.runCardTitle", { id: target })}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("workers.runCardLead")}</DialogDescription>
        {open && (proposal
          ? <RunCard key={`${proposal.mode}-${proposal.workerId ?? proposal.branch}`} proposal={proposal} errors={errors} refusals={refusals} busy={busy} error={error} onAccept={onAccept} onCancel={() => onOpenChange(false)} onOpenWorker={onOpenWorker} />
          : error ? <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{error}</p>
          : <p role="status" className="text-xs text-muted">{t("workers.proposing")}</p>)}
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Work with agent" on an epic or a task (T560): `open()` asks the server for the run card (GET /api/workers/propose),
 * Accept posts it (POST /api/workers: it answers before the worktree's install) and goes to the worker's chat on /chat.
 * `dialog` goes in the tree once.
 */
export function useRunCard(target: Attach, onStarted?: () => void): { open: () => void; dialog: ReactNode } {
  const { t } = useT()
  const { rootParam } = useApp()
  const router = useRouter()
  const [state, setState] = useState<"closed" | "open" | "starting">("closed")
  const [error, setError] = useState<string | null>(null)
  // T561: the server routes the run (new worktree, or the epic's worker); nothing exists until Accept
  const [proposal, setProposal] = useState<{ proposal: RunProposal; errors: string[]; refusals?: RunRefusal[] } | null>(null)
  const goToWorker = (id: string) => {
    setState("closed")
    onStarted?.()
    router.push(`/chat?id=${encodeURIComponent(id)}`)
  }
  const opener = useRef<HTMLElement | null>(null)
  const open = async () => {
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    setError(null)
    setProposal(null)
    setState("open")
    try {
      const res = await fetch(`/api/workers/propose${rootParam}&kind=${target.kind}&id=${encodeURIComponent(target.id)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.proposal) throw new Error(data?.error ?? t("board.requestFailed", { status: res.status }))
      setProposal(data)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const accept = async (v: RunValues) => {
    setState("starting")
    setError(null)
    try {
      const res = await fetch(`/api/workers${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, mode: proposal?.proposal.mode, workerId: proposal?.proposal.workerId, branch: v.branch, base: v.base }),
      })
      const data = await res.json().catch(() => null)
      // refused on Accept (state changed since the card opened): the reasons replace the card's
      if (res.status === 409 && data?.refusals && proposal) {
        setProposal({ ...proposal, errors: data.errors, refusals: data.refusals })
        setState("open")
        return
      }
      if (!res.ok || !data?.id) throw new Error(data?.error ?? t("board.requestFailed", { status: res.status }))
      goToWorker(data.id)
    } catch (e) {
      setError((e as Error).message)
      setState("open")
    }
  }
  return {
    open: () => { void open() },
    dialog: (
      <RunCardDialog
        target={target.id}
        proposal={proposal?.proposal ?? null}
        errors={proposal?.errors}
        refusals={proposal?.refusals}
        open={state !== "closed"}
        onOpenChange={(o) => setState(o ? "open" : "closed")}
        busy={state === "starting"}
        error={error}
        onAccept={accept}
        onOpenWorker={goToWorker}
        returnFocus={() => opener.current}
      />
    ),
  }
}
