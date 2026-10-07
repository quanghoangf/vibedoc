"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { DocLint, LintIssue, LintRule } from "@/lib/doc-lint"
import { cn } from "@/lib/utils"
import { scrollToHeading } from "./MarkdownRenderer"

const RULE_LABEL: Record<LintRule, MessageKey> = {
  "broken-link": "docs.lintRuleBrokenLink",
  "stale-path": "docs.lintRuleStalePath",
  "bad-frontmatter": "docs.lintRuleBadFrontmatter",
  "no-h1": "docs.lintRuleNoH1",
  "empty-doc": "docs.lintRuleEmptyDoc",
  "orphan-doc": "docs.lintRuleOrphanDoc",
  "spec-structure": "docs.lintRuleSpecStructure",
  "spec-changes": "docs.lintRuleSpecChanges",
  "outdated-ref": "docs.lintRuleOutdatedRef",
}

// SSE events that can change what the lint finds (a file or a link moved)
export const RELINT = new Set(["doc_updated", "doc_created", "doc_deleted", "doc_renamed", "decision_logged", "roadmap_updated", "task_updated", "task_created", "memory_updated"])

/**
 * R088: the docs check line ("2 errors · 5 warnings") above the doc list; it opens the issues grouped by file, and
 * a click opens the doc at that spot: the link itself (`?link=`) or the section heading the issue sits in.
 */
export function DocLintPanel({ onOpen }: { onOpen?: () => void }) {
  const { rootParam, activeProject, openDoc } = useApp()
  const { t, tn } = useT()
  const [lint, setLint] = useState<DocLint | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    if (!activeProject) return
    fetch(`/api/docs/lint${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DocLint | null) => setLint(d && Array.isArray(d.issues) ? d : null))
      .catch(() => {})
  }, [activeProject, rootParam])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onSse = (e: Event) => { if (RELINT.has((e as CustomEvent).detail?.type)) load() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const byFile = useMemo(() => {
    const m = new Map<string, LintIssue[]>()
    for (const i of lint?.issues ?? []) m.set(i.path, [...(m.get(i.path) ?? []), i])
    return [...m.entries()]
  }, [lint])

  if (!lint || !lint.files) return null
  const clean = !lint.errors && !lint.warnings

  async function go(i: LintIssue) {
    onOpen?.()
    await openDoc(i.path, i.target)
    if (!i.target && i.heading) scrollToHeading(i.heading)
  }

  return (
    <div className="border-b border-border" data-doc-lint>
      <button
        type="button"
        onClick={() => !clean && setOpen((v) => !v)}
        aria-expanded={clean ? undefined : open}
        aria-controls={clean ? undefined : "doc-lint-issues"}
        disabled={clean}
        title={t("docs.lintTitle")}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] text-muted transition-colors enabled:hover:bg-surface2 enabled:hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {clean ? (
          <><CircleCheck className="size-3.5 shrink-0 text-teal" aria-hidden /><span>{t("docs.lintPassed")}</span></>
        ) : (
          <>
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
            <span data-lint-summary>
              <span className={cn(lint.errors > 0 && "text-danger")}>{tn("docs.lintErrors", lint.errors)}</span>
              {" · "}
              <span className={cn(lint.warnings > 0 && "text-amber")}>{tn("docs.lintWarnings", lint.warnings)}</span>
            </span>
          </>
        )}
      </button>
      {open && !clean && (
        <ul id="doc-lint-issues" aria-label={t("docs.lintTitle")} className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
          {byFile.map(([path, issues]) => (
            <li key={path} className="mt-1">
              <div data-user-content className="truncate px-1.5 font-mono text-[10px] text-muted" title={path}>{path}</div>
              <ul>
                {issues.map((i) => (
                  <li key={`${i.line}:${i.rule}:${i.target ?? ""}:${i.message}`}>
                    <button
                      type="button"
                      onClick={() => void go(i)}
                      title={i.message}
                      data-lint-rule={i.rule}
                      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-muted transition-colors hover:bg-surface2 hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {i.level === "error"
                        ? <CircleAlert className="size-3.5 shrink-0 text-danger" aria-hidden />
                        : <TriangleAlert className="size-3.5 shrink-0 text-amber" aria-hidden />}
                      <span className="shrink-0 font-mono text-[10px]" aria-label={t("docs.lintLine", { n: i.line })}>L{i.line}</span>
                      <span className="shrink-0">{t(RULE_LABEL[i.rule])}</span>
                      {i.target && <span data-user-content className="min-w-0 truncate font-mono text-[10px]">{i.target}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
