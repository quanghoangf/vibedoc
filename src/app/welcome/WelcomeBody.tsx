"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useT } from "@/context/LanguageContext"
import { applyAccent, applyTheme } from "@/lib/applySettings"
import type { AppSettings } from "@/lib/settings"
import type { MessageKey } from "@/i18n"
import { CopyCommand } from "./CopyCommand"

const GITHUB = "https://github.com/quanghoangf/vibedoc"

const FEATURES: { title: MessageKey; body: MessageKey }[] = [
  { title: "welcome.landingBoardTitle", body: "welcome.landingBoardBody" },
  { title: "welcome.landingRoadmapTitle", body: "welcome.landingRoadmapBody" },
  { title: "welcome.landingMemoryTitle", body: "welcome.landingMemoryBody" },
  { title: "welcome.landingChatTitle", body: "welcome.landingChatBody" },
]

const button = "rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

/** The landing's text, in the UI language (R078). Outside the (app) layout, so it applies the saved theme and accent itself. */
export function WelcomeBody({ toolCount }: { toolCount: number }) {
  const { t } = useT()

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings?type=settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Partial<AppSettings> | null) => {
        if (cancelled || !s) return
        if (s.theme) applyTheme(s.theme)
        if (s.accentColor) applyAccent(s.accentColor)
      })
      .catch((e) => console.warn("[vibedoc] welcome: could not read settings:", e))
    return () => { cancelled = true }
  }, [])

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <h1 className="font-display text-3xl font-semibold text-txt sm:text-5xl">{t("welcome.landingTitle")}</h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{t("welcome.landingLead")}</p>

      <div className="mt-8">
        <CopyCommand command="npx vibedoc" />
      </div>

      <nav aria-label={t("welcome.landingNav")} className="mt-6 flex flex-wrap gap-3">
        <Link href="/board" className={`${button} bg-accent text-accent-fg hover:opacity-90`}>{t("welcome.landingDemo")}</Link>
        <Link href="/roadmap" className={`${button} border border-border text-txt hover:bg-surface2`}>{t("welcome.landingRoadmap")}</Link>
        <Link href="/getting-started" className={`${button} border border-border text-txt hover:bg-surface2`}>{t("welcome.landingGettingStarted")}</Link>
        <a href={GITHUB} className={`${button} border border-border text-txt hover:bg-surface2`}>GitHub</a>
      </nav>

      <section aria-labelledby="features" className="mt-16">
        <h2 id="features" className="sr-only">{t("welcome.landingFeatures")}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-display text-base font-semibold text-txt">{t(f.title)}</h3>
              <p className="mt-2 text-sm text-muted">{t(f.body, { n: toolCount })}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
