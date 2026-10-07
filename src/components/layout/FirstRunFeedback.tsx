"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { STEPS, stepUrl, type StepId } from "@/lib/first-run"

const STEP_LABEL: Record<StepId, MessageKey> = {
  started: "feedback.stepStarted",
  "agent-connected": "feedback.stepAgent",
  "first-roadmap": "feedback.stepRoadmap",
  "first-task-done": "feedback.stepTask",
}
// Events that can reach a step (session_start = an agent connected)
const STEP_EVENTS = ["session_start", "task_updated", "task_created", "roadmap_updated", "feedback_updated"]

interface FeedbackStatus { available: boolean; consent: boolean | null; pending: StepId[] }

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

  const sendPending = useCallback(async (pending: StepId[]) => {
    if (sending.current) return
    sending.current = true
    try {
      for (const step of pending) {
        // no-cors: the answer is opaque and unneeded; keepalive lets it finish if the tab closes
        await fetch(stepUrl(step), { mode: "no-cors", keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" })
        await fetch(`/api/feedback/sent${rootParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        })
      }
    } catch (e) {
      console.warn("[vibedoc] first-run feedback not sent", e) // offline or blocked: tried again on the next change
    } finally {
      sending.current = false
    }
  }, [rootParam])

  const load = useCallback(async () => {
    try {
      const s: FeedbackStatus = await fetch(`/api/feedback${rootParam}`).then((r) => r.json())
      setStatus(s)
      if (s.available && s.consent === true && s.pending.length) await sendPending(s.pending)
    } catch {
      setStatus(null)
    }
  }, [rootParam, sendPending])

  useEffect(() => {
    load()
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type
      if (type && STEP_EVENTS.includes(type)) load()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const answer = async (consent: boolean) => {
    setStatus((s) => (s ? { ...s, consent } : s))
    try {
      const r = await fetch(`/api/feedback${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      }).then((res) => res.json())
      if (consent && r.pending?.length) await sendPending(r.pending)
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
      <div className="mt-3 flex flex-wrap justify-end gap-2">
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
