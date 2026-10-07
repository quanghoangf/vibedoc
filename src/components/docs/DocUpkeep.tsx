"use client"

import { useCallback, useEffect, useState } from "react"
import { Sparkles, TriangleAlert } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { askAgent } from "@/lib/ask-agent"
import type { DocLint, LintIssue } from "@/lib/doc-lint"
import { fixDocsPrompt } from "@/lib/doc-upkeep"
import { RELINT } from "./DocLintPanel"

/**
 * R092: "May be outdated" under the doc title when done tasks renamed or deleted files the doc names (the
 * `outdated-ref` issues of the doc's lint), and Fix docs, which asks the agent to propose the corrections.
 */
export function DocUpkeep({ path }: { path: string }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [issues, setIssues] = useState<LintIssue[]>([])

  const load = useCallback(() => {
    const sep = rootParam.length > 1 ? "&" : "" // rootParam is "?" or "?root=…"
    fetch(`/api/docs/lint${rootParam}${sep}path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DocLint | null) => setIssues(Array.isArray(d?.issues) ? d.issues : []))
      .catch(() => setIssues([]))
  }, [path, rootParam])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onSse = (e: Event) => { if (RELINT.has((e as CustomEvent).detail?.type)) load() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const refs = issues.filter((i) => i.rule === "outdated-ref")
  if (!refs.length) return null
  return (
    <section data-doc-outdated aria-label={t("docs.outdatedTitle")} className="mt-4 rounded-md border border-amber/40 bg-amber/5 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <TriangleAlert className="size-3.5 shrink-0 text-amber" aria-hidden />
        <span className="font-medium text-txt">{t("docs.outdatedTitle")}</span>
        <span className="text-muted">{t("docs.outdatedHint")}</span>
        <Button
          size="sm"
          variant="outline"
          data-fix-docs
          title={t("docs.fixDocsHint")}
          onClick={() => askAgent(fixDocsPrompt(path, issues))}
          className="ml-auto h-7 gap-1 px-2 text-xs"
        >
          <Sparkles className="size-3.5" aria-hidden /> {t("docs.fixDocs")}
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {refs.map((r) => (
          <li key={`${r.line}:${r.target}`} data-outdated-ref className="flex flex-wrap items-baseline gap-x-2 text-muted">
            <span className="font-mono text-[11px] text-txt">{r.task}</span>
            <span data-user-content className="font-mono text-[11px]">
              {r.target} {r.renamedTo ? <>→ {r.renamedTo}</> : <span className="font-sans">({t("docs.outdatedDeleted")})</span>}
            </span>
            <span className="font-mono text-[10px]" aria-label={t("docs.lintLine", { n: r.line })}>L{r.line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
