"use client"

import { useCallback, useEffect, useState } from "react"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import type { UsageSummary } from "@/lib/doc-usage"

const SHOWN = 8

/** R093: on the /docs landing — which docs agents read, and which they never open. */
export function DocUsage({ onDocClick }: { onDocClick?: (path: string) => void }) {
  const { rootParam, activeProject } = useApp()
  const { t, tn } = useT()
  const { agoShort } = useFormat()
  const [usage, setUsage] = useState<UsageSummary | null>(null)

  const load = useCallback(() => {
    if (!activeProject) return
    fetch(`/api/docs/usage${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageSummary | null) => setUsage(d?.mostRead ? d : null))
      .catch(() => {})
  }, [activeProject, rootParam])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    // a doc created or deleted changes "never read" too
    const onSse = (e: Event) => {
      const type = (e as CustomEvent).detail?.type
      if (type === "doc_usage_updated" || type === "doc_updated") load()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  if (!usage) return null
  const docButton = (path: string) => (
    <button type="button" onClick={() => onDocClick?.(path)} data-user-content
      className="min-w-0 truncate text-left font-mono text-xs text-txt hover:underline">
      {path}
    </button>
  )
  const more = (n: number) => n > SHOWN && <li className="text-xs text-muted">{t("docs.moreCount", { n: n - SHOWN })}</li>

  return (
    <section aria-label={t("docs.usageTitle")} className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h3 className="text-sm font-semibold text-txt">{t("docs.usageTitle")}</h3>
        <p className="mt-1 text-xs text-muted">{t("docs.usageLead")}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div role="group" aria-label={t("docs.readByAgents")} data-usage="read">
          <h4 className="mb-2 text-xs font-medium text-muted">{t("docs.readByAgents")}</h4>
          {usage.mostRead.length === 0 ? <p className="text-xs text-muted">{t("docs.noReadsYet")}</p> : (
            <ul className="flex flex-col gap-1.5">
              {usage.mostRead.slice(0, SHOWN).map((r) => (
                <li key={r.path} data-path={r.path} className="flex items-baseline justify-between gap-3">
                  {docButton(r.path)}
                  <span className="shrink-0 text-[11px] text-muted" title={r.last}>
                    {tn("docs.readCount", r.count)} · {agoShort(r.last)}
                  </span>
                </li>
              ))}
              {more(usage.mostRead.length)}
            </ul>
          )}
        </div>
        <div role="group" aria-label={t("docs.neverRead")} data-usage="never">
          <h4 className="mb-2 text-xs font-medium text-muted">{t("docs.neverRead")}</h4>
          {usage.neverRead.length === 0 ? <p className="text-xs text-muted">{t("docs.allDocsRead")}</p> : (
            <ul className="flex flex-col gap-1.5">
              {usage.neverRead.slice(0, SHOWN).map((p) => <li key={p} data-path={p} className="flex">{docButton(p)}</li>)}
              {more(usage.neverRead.length)}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
