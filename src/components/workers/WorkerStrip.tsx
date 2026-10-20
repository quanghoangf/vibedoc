"use client"

import { useState } from "react"
import { Check, Copy, GitBranch, Play } from "lucide-react"
import { useFormat, useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { Worker, WorkerPhase, WorkerTurn } from "@/lib/chats"
import { sumUsage } from "@/lib/worker-state"

const PHASE_KEY: Record<WorkerPhase, MessageKey> = {
  starting: "workers.phaseStarting",
  running: "workers.phaseRunning",
  paused: "workers.phasePaused",
  "wait-user": "workers.phaseWaitUser",
  ended: "workers.phaseEnded",
  stopped: "workers.phaseStopped",
  failed: "workers.phaseFailed",
}

/** The task a worker is on: its last turn while it has no result. */
export function currentTask(w: Worker): string | null {
  const last = w.turns[w.turns.length - 1]
  return last && last.result === null ? last.taskId : null
}

/** T567: "12 turns · 3m · $0.73" for some turns' usage (one task's, or the whole worker's); null when none reported. */
export function useUsageText() {
  const { tn } = useT()
  const { duration, lang } = useFormat()
  return (turns: WorkerTurn[]): string | null => {
    if (!turns.some((x) => x.usage)) return null
    const u = sumUsage(turns.map((x) => x.usage))
    const cost = new Intl.NumberFormat(lang, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(u.costUsd)
    return [tn("workers.usageTurns", u.turns), duration(Math.round(u.durationMs / 60_000)), cost].join(" · ")
  }
}

/** T556: its last task's process died without a result (e.g. while VibeDoc was down): it waits for Resume. */
export function isInterrupted(w: Worker): boolean {
  return w.phase === "wait-user" && w.turns[w.turns.length - 1]?.result === "interrupted"
}

/**
 * Under a worker chat's header: branch, folder (copy), base, phase, the current task and what it has used so far.
 * `onResume` (T556): the Resume button an interrupted worker shows.
 */
export function WorkerStrip({ worker, onResume }: { worker: Worker; onResume?: () => void }) {
  const { t } = useT()
  const { clock } = useFormat()
  const usage = useUsageText()(worker.turns)
  const [copied, setCopied] = useState(false)
  const task = currentTask(worker)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(worker.dir)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked: the path stays selectable
    }
  }
  return (
    <div data-worker-strip className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface2/50 px-5 py-2 text-xs">
      <span className="inline-flex items-center gap-1 font-mono text-txt">
        <GitBranch className="size-3.5 text-muted" aria-hidden />
        <span className="sr-only">{t("workers.branch")}</span>
        <span data-user-content>{worker.branch}</span>
      </span>
      <span className="text-muted">{t("workers.base")} <span data-user-content className="font-mono text-txt">{worker.base}</span></span>
      <span className="inline-flex min-w-0 items-center gap-1 text-muted">
        {t("workers.folder")}
        <span data-user-content className="min-w-0 select-all truncate font-mono text-txt" title={worker.dir}>{worker.dir}</span>
        <button type="button" onClick={copy} aria-label={copied ? t("workers.copied") : t("workers.copyFolder")} title={t("workers.copyFolder")} className="rounded-sm p-0.5 hover:bg-surface2 hover:text-txt">
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        </button>
      </span>
      <span className="ml-auto inline-flex items-center gap-2">
        {task && <span className="font-mono text-accent">{t("workers.currentTask", { id: task })}</span>}
        {usage && <span data-worker-usage className="text-muted" title={t("workers.usageTotal")}>{usage}</span>}
        <span className="text-muted" title={worker.reason}>
          {worker.removedAt ? t("workers.phaseRemoved")
            : worker.phase === "paused" && worker.retryAt ? t("workers.pausedUntil", { time: clock(worker.retryAt) })
            : isInterrupted(worker) ? t("workers.phaseInterrupted") : t(PHASE_KEY[worker.phase])}
        </span>
        {isInterrupted(worker) && onResume && (
          <button type="button" onClick={onResume} title={t("workers.resumeHint")} className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-txt hover:border-accent/50 hover:text-accent">
            <Play className="size-3" aria-hidden />
            {t("workers.resume")}
          </button>
        )}
      </span>
    </div>
  )
}
