"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import { FeedbackDetails } from "@/components/layout/FirstRunFeedback"

/** Settings → Privacy (R086): change the first-run feedback answer any time. The card in the layout does the sending. */
export function PrivacySettings({ rootParam }: { rootParam: string }) {
  const { t } = useT()
  const [state, setState] = useState<{ available: boolean; consent: boolean | null } | null>(null)

  const load = useCallback(() => {
    fetch(`/api/feedback${rootParam}`)
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ available: false, consent: null }))
  }, [rootParam])

  useEffect(() => {
    load()
    const onSse = (e: Event) => { if ((e as CustomEvent<{ type?: string }>).detail?.type === "feedback_updated") load() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const on = state?.available === true && state.consent === true
  const toggle = async () => {
    const consent = !on
    setState((s) => (s ? { ...s, consent } : s))
    try {
      await fetch(`/api/feedback${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      })
    } catch (e) {
      console.warn("[vibedoc] first-run feedback setting not saved", e)
    }
    load()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabPrivacy")}</h2>
        <p className="text-sm text-muted">{t("feedback.privacyHint")}</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div id="feedback-toggle-label" className="text-sm font-medium text-txt">{t("feedback.toggle")}</div>
            <div className="text-xs text-muted">{state && !state.available ? t("feedback.unavailable") : t("feedback.toggleHint")}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="feedback-toggle-label"
            disabled={!state?.available}
            onClick={toggle}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-accent" : "bg-border")}
          >
            <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", on ? "left-6" : "left-1")} />
          </button>
        </div>
        <FeedbackDetails />
      </div>
    </div>
  )
}
