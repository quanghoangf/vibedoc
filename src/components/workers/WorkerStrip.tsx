"use client"

import { useState } from "react"
import { Check, Copy, GitBranch } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { Worker, WorkerPhase } from "@/lib/chats"

const PHASE_KEY: Record<WorkerPhase, MessageKey> = {
  starting: "workers.phaseStarting",
  running: "workers.phaseRunning",
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

/** Under a worker chat's header: branch, folder (copy), base, phase and the current task. */
export function WorkerStrip({ worker }: { worker: Worker }) {
  const { t } = useT()
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
        <span className="text-muted" title={worker.reason}>{t(PHASE_KEY[worker.phase])}</span>
      </span>
    </div>
  )
}
