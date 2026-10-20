"use client"

import { useEffect, useState } from "react"
import { Bot } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { RunCard, type RunValues } from "@/components/workers/RunCard"
import type { RunProposal, RunRefusal, RunRequest } from "@/lib/run-proposal"

export type RunCardStatus = "pending" | "accepted" | "rejected"

/** T562: a `vibedoc_propose_run` tool use in the orchestrator chat. `request` is the tool's input; the server routes it. */
export interface RunCardSet {
  id: string
  request: RunRequest & { target: string }
  status: RunCardStatus
  /** accepted: the worker that took the run */
  workerId?: string
}

/**
 * The orchestrator's run card: the same card and the same POST /api/workers as the epic sheet's "Work with agent".
 * The proposal is fetched again on mount (GET /api/workers/propose), so it reflects the workers as they are now.
 */
export function RunProposalCard({ set, onResolve, onOpenWorker }: {
  set: RunCardSet
  onResolve: (status: RunCardStatus, workerId?: string) => void
  onOpenWorker: (workerId: string) => void
}) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [data, setData] = useState<{ proposal: RunProposal; errors: string[]; refusals?: RunRefusal[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { target, mode, workerId, branch, base } = set.request
  const pending = set.status === "pending"
  const accepted = set.workerId

  useEffect(() => {
    if (!pending) return
    const q = new URLSearchParams({ kind: "epic", id: target, ...(mode && { mode }), ...(workerId && { workerId }), ...(branch && { branch }), ...(base && { base }) })
    let cancelled = false
    fetch(`/api/workers/propose${rootParam}&${q}`)
      .then(async (res) => {
        const d = await res.json().catch(() => null)
        if (!res.ok || !d?.proposal) throw new Error(d?.error ?? t("board.requestFailed", { status: res.status }))
        if (!cancelled) setData(d)
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message) })
    return () => { cancelled = true }
  }, [pending, rootParam, target, mode, workerId, branch, base, t])

  async function accept(v: RunValues) {
    if (!data) return
    setBusy(true)
    setError(null)
    try {
      const p = data.proposal
      const res = await fetch(`/api/workers${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: p.target, mode: p.mode, workerId: p.workerId, branch: v.branch, base: v.base }),
      })
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.refusals) return setData({ ...data, errors: d.errors, refusals: d.refusals })
      if (!res.ok || !d?.id) throw new Error(d?.error ?? t("board.requestFailed", { status: res.status }))
      onResolve("accepted", d.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-run-card className="rounded-lg border border-border bg-surface p-3 animate-fade-in">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-txt">
        <Bot className="size-3.5 text-accent" aria-hidden /> {t("workers.runCardTitle", { id: target })}
      </p>
      {set.status === "accepted" ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted">
          {t("workers.runAccepted")}
          {accepted && (
            <button type="button" onClick={() => onOpenWorker(accepted)} className="text-accent hover:underline">{t("workers.openWorker")}</button>
          )}
        </p>
      ) : set.status === "rejected" ? (
        <p role="status" className="text-xs text-muted">{t("workers.runRejected")}</p>
      ) : data ? (
        <RunCard
          key={`${data.proposal.mode}-${data.proposal.workerId ?? data.proposal.branch}`}
          proposal={data.proposal}
          errors={data.errors}
          refusals={data.refusals}
          onOpenWorker={onOpenWorker}
          busy={busy}
          error={error}
          onAccept={accept}
          onCancel={() => onResolve("rejected")}
          cancelLabel={t("workers.reject")}
        />
      ) : error ? (
        <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{error}</p>
      ) : (
        <p role="status" className="text-xs text-muted">{t("workers.proposing")}</p>
      )}
    </div>
  )
}
