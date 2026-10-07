"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { STEPS, issueUrl, stepUrl, type StepId } from "@/lib/first-run"

const STEP_LABEL: Record<StepId, MessageKey> = {
  started: "feedback.stepStarted",
  "agent-connected": "feedback.stepAgent",
  "first-roadmap": "feedback.stepRoadmap",
  "first-task-done": "feedback.stepTask",
}
// Events that can reach a step (session_start = an agent connected)
const STEP_EVENTS = ["session_start", "task_updated", "task_created", "roadmap_updated"]

interface FeedbackStatus { available: boolean; consent: boolean | null; pending: StepId[]; version: string; lastStep: StepId }

/** Exactly what VibeDoc can send (the card and Settings → Privacy): each step with its request, then what never goes. */
export function FeedbackDetails() {
  const { t } = useT()
  return (
    <div className="space-y-2 text-xs text-muted">
      <p>{t("feedback.whatSent")}</p>
      <ul className="space-y-1.5">
        {STEPS.map((s) => (
          <li key={s}>
            <span className="text-txt">{t(STEP_LABEL[s])}</span>
            <code className="mt-0.5 block break-all font-mono text-[11px] text-muted">GET {stepUrl(s)}</code>
          </li>
        ))}
      </ul>
      <p>{t("feedback.neverSent")}</p>
    </div>
  )
}

/** The OS family only (never the version or the machine). */
function osName(): string {
  const p = ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "").toLowerCase()
  if (p.startsWith("mac")) return "macOS"
  if (p.startsWith("win")) return "Windows"
  if (p.includes("linux")) return "Linux"
  return ""
}

/**
 * "Stuck? Tell us" (R086): a prefilled GitHub issue the user reads and submits, with or without consent. Pass the
 * version and last step when they are at hand (the card), else it asks /api/feedback. Seam for R084's checklist.
 */
export function StuckLink({ info, className }: { info?: Pick<FeedbackStatus, "version" | "lastStep">; className?: string }) {
  const { t } = useT()
  const { rootParam } = useApp()
  const [fetched, setFetched] = useState<Pick<FeedbackStatus, "version" | "lastStep"> | null>(null)
  useEffect(() => {
    if (info) return
    fetch(`/api/feedback${rootParam}`).then((r) => r.json()).then(setFetched).catch(() => {})
  }, [info, rootParam])
  const s = info ?? fetched
  if (!s?.version) return null
  return (
    <a
      href={issueUrl({ version: s.version, os: osName(), lastStep: s.lastStep })}
      target="_blank"
      rel="noopener noreferrer"
      title={t("feedback.stuckHint")}
      className={className ?? "text-xs text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"}
    >
      {t("feedback.stuck")}
    </a>
  )
}

/**
 * First-run feedback (R086): asks once per project (a non-modal card, never a dialog, so page keys keep working),
 * then, only when the answer is yes, sends each reached step once from this browser. The server says which steps
 * are pending; nothing here decides consent. R082's welcome screen can host this same component later.
 */
export function FirstRunFeedback() {
  const { t } = useT()
  const { rootParam } = useApp()
  const [status, setStatus] = useState<FeedbackStatus | null>(null)
  const sending = useRef(false)
  // A stale GET can still list a step this tab just sent: never send one twice from here
  const sentHere = useRef(new Set<StepId>())

  const sendPending = useCallback(async (pending: StepId[]) => {
    if (sending.current) return
    sending.current = true
    try {
      for (const step of pending) {
        if (sentHere.current.has(step)) continue
        // no-cors: the answer is opaque and unneeded; keepalive lets it finish if the tab closes
        await fetch(stepUrl(step), { mode: "no-cors", keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" })
        await fetch(`/api/feedback/sent${rootParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        })
        sentHere.current.add(step)
      }
    } catch (e) {
      console.warn("[vibedoc] first-run feedback not sent", e) // offline or blocked: tried again on the next change
    } finally {
      sending.current = false
    }
  }, [rootParam])

  const load = useCallback(() =>
    fetch(`/api/feedback${rootParam}`)
      .then((r) => r.json() as Promise<FeedbackStatus>)
      .then((s) => {
        setStatus(s)
        if (s.available && s.consent === true && s.pending.length) return sendPending(s.pending)
      })
      .catch(() => setStatus(null)), [rootParam, sendPending])

  useEffect(() => {
    load()
  }, [load])

  // Only an opted-in project can have a step to send: the others listen for a changed answer alone
  const optedIn = status?.consent === true
  useEffect(() => {
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type
      if (type === "feedback_updated" || (optedIn && type && STEP_EVENTS.includes(type))) load()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load, optedIn])

  const answer = async (consent: boolean) => {
    setStatus((s) => (s ? { ...s, consent } : s))
    try {
      await fetch(`/api/feedback${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      })
      await load()
    } catch (e) {
      console.warn("[vibedoc] first-run feedback answer not saved", e)
    }
  }

  if (!status?.available || status.consent !== null) return null
  return (
    <section
      role="region"
      aria-label={t("feedback.cardLabel")}
      className="fixed inset-x-4 bottom-16 z-40 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-surface2 p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:w-[380px]"
    >
      <h2 className="text-sm font-semibold text-txt">{t("feedback.title")}</h2>
      <p className="mt-1 text-xs text-muted">{t("feedback.lead")}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-accent">{t("feedback.showDetails")}</summary>
        <div className="mt-2"><FeedbackDetails /></div>
      </details>
      <p className="mt-2 text-xs text-muted">{t("feedback.changeLater")}</p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto"><StuckLink info={status} /></span>
        <button type="button" onClick={() => answer(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-txt hover:bg-surface">
          {t("feedback.no")}
        </button>
        <button type="button" onClick={() => answer(true)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          {t("feedback.yes")}
        </button>
      </div>
    </section>
  )
}
