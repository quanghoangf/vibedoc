"use client"

import { FileText } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

/**
 * A search that found nothing: what was searched, doc names that look like the query (core `suggestDocs`), a hint
 * to broaden it, and an optional action (e.g. widen the scope). Used by /search and the docs list search.
 */
export function NoMatch({ message, suggestions, onOpen, action, compact = false }: {
  message: string
  suggestions: string[]
  onOpen: (path: string) => void
  action?: { label: string; onClick: () => void }
  compact?: boolean
}) {
  const { t } = useT()
  return (
    <div data-no-match className={cn("flex flex-col gap-2", compact ? "px-2 py-4 text-xs" : "text-sm")}>
      <p className="text-muted">{message}</p>
      {suggestions.length > 0 && (
        <div>
          <p className={cn("mb-1 font-medium text-txt", compact ? "text-[11px]" : "text-xs")}>{t("search.similarNames")}</p>
          <ul className="flex flex-col">
            {suggestions.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  data-suggestion={path}
                  onClick={() => onOpen(path)}
                  className="flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-muted hover:bg-surface2 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  <span data-user-content className="truncate font-mono text-[11px]">{path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-muted">
        {t("search.broaden")}
        {action && <>{" "}<button type="button" onClick={action.onClick} className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{action.label}</button></>}
      </p>
    </div>
  )
}
