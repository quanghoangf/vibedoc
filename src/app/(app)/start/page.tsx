"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Sparkles } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { askAgent } from "@/lib/ask-agent"
import { welcomeKind } from "@/lib/first-screen"

/** First run on a project with no tasks and no roadmap (R082): one start that fits what the project has. `/` sends new projects here. */
export default function WelcomePage() {
  const { rootParam, activeProject } = useApp()
  const { t } = useT()
  const [kind, setKind] = useState<"docs" | "empty" | null>(null)

  useEffect(() => {
    if (!activeProject) return
    fetch(`/api/docs${rootParam}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((docs: { path?: string }[]) => setKind(welcomeKind(Array.isArray(docs) ? docs.map((d) => d?.path ?? "") : [])))
      .catch((e) => {
        console.error("[vibedoc] welcome: could not list docs:", e)
        setKind("empty")
      })
  }, [activeProject, rootParam])

  const board = `/board${rootParam === "?" ? "" : rootParam}`
  const docs = kind === "docs"

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-txt">{t("welcome.title")}</h1>
      {kind === null ? (
        <p className="text-sm text-muted" aria-busy="true">{t("welcome.loading")}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{t(docs ? "welcome.docsLead" : "welcome.emptyLead")}</p>
          <Button
            onClick={() => askAgent(docs ? "Plan a roadmap for this project from its docs." : "Plan the first epics for this project.")}
            className="bg-accent text-accent-fg hover:bg-accent/90"
          >
            {docs ? <Sparkles /> : <Bot />} {t(docs ? "welcome.docsStart" : "welcome.emptyStart")}
          </Button>
          <Link href={board} className="text-xs text-muted underline-offset-2 hover:text-txt hover:underline">{t("welcome.skip")}</Link>
        </>
      )}
    </section>
  )
}
