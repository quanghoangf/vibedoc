"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, FileText, Sparkles } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { ConnectSlot } from "@/components/welcome/ConnectSlot"
import { ToolkitStep } from "@/components/welcome/ToolkitStep"
import { askAgent } from "@/lib/ask-agent"
import { welcomeTarget } from "@/lib/first-screen"

/** First run on a project with no tasks and no roadmap (R082): one start that fits what the project has. `/` sends new projects here. */
export default function WelcomePage() {
  const { rootParam, activeProject, demo: readOnlyDemo } = useApp()
  const { t } = useT()
  const router = useRouter()
  const [kind, setKind] = useState<"docs" | "empty" | null>(null)
  const q = rootParam === "?" ? "" : rootParam
  const board = `/board${q}`

  useEffect(() => {
    if (!activeProject) return
    const json = (path: string, q: string) => fetch(`${path}${rootParam}${q}`).then((r) => (r.ok ? r.json() : null))
    // the root .md files and docs/, plus any other folder (names only) that holds a project doc; tasks and roadmap
    // decide like `/` does, so a project that is already set up goes to the board instead of this welcome
    Promise.all([json("/api/docs", ""), json("/api/docs", "&folders=1"), json("/api/tasks", ""), json("/api/roadmap", "")])
      .then(([docs, folders, tasks, roadmap]: [{ path?: string }[] | null, { hasDocs?: boolean }[] | null, { tasks?: unknown[] } | null, { items?: unknown[] } | null]) => {
        const target = welcomeTarget({
          tasks: tasks?.tasks?.length ?? 0,
          roadmapItems: roadmap?.items?.length ?? 0,
          demo: readOnlyDemo,
          docPaths: Array.isArray(docs) ? docs.map((d) => d?.path ?? "") : [],
          docsElsewhere: Array.isArray(folders) && folders.some((f) => f?.hasDocs),
        })
        if (target === "board") router.replace(board)
        else setKind(target)
      })
      .catch((e) => {
        console.error("[vibedoc] welcome: could not list docs:", e)
        setKind("empty")
      })
  }, [activeProject, rootParam, readOnlyDemo, router, board])

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
          <ConnectSlot />
          <ToolkitStep />
          <div className="mt-6 flex flex-col items-center gap-1 border-t border-border pt-4">
            <Button asChild variant="outline" size="sm"><Link href={`/setup${q}`}><FileText /> {t("welcome.writeDocs")}</Link></Button>
            <p className="text-xs text-muted">{t("welcome.writeDocsHint")}</p>
          </div>
        </>
      )}
    </section>
  )
}
