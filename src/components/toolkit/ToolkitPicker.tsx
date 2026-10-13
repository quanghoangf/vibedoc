"use client"

import { Check, TriangleAlert } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { CommandBlock } from "@/components/connect/ConnectAgentPanel"
import type { MessageKey } from "@/i18n"
import type { ToolkitSignal } from "@/lib/toolkit"

/** One row of GET /api/toolkit. */
export interface ToolkitEntry {
  id: string
  title: string
  reason: { en: string; vi: string }
  matched?: ToolkitSignal
  installed: boolean
  commands: string[]
}

/** One row of POST /api/toolkit's results. */
export interface ToolkitResult { id: string; ok: boolean; stdout?: string; stderr?: string; missing?: boolean }

const FIT_KEYS: Record<ToolkitSignal, MessageKey> = {
  "web-frontend": "welcome.fitWebFrontend", git: "welcome.fitGit", server: "welcome.fitServer",
  "lsp-ts": "welcome.fitLspTs", "lsp-py": "welcome.fitLspPy", "lsp-go": "welcome.fitLspGo",
}

/**
 * R098: the ranked plugin list with a reason each. Installed items (or ones the last run proved) show ✓ and can't be
 * ticked; a failed install shows the real error and the commands to copy. Without the CLI every item shows its commands.
 * Shared by the welcome step and the chat's toolkit card.
 */
export function ToolkitPicker({ items, selected, onToggle, results, cli, disabled }: {
  items: ToolkitEntry[]
  selected: Set<string>
  onToggle: (id: string) => void
  results: Map<string, ToolkitResult>
  cli: boolean
  disabled?: boolean
}) {
  const { t, lang } = useT()
  return (
    <ul className="space-y-2 text-left">
      {items.map((item) => {
        const result = results.get(item.id)
        const installed = item.installed || result?.ok === true
        const failed = result && !result.ok
        const box = `toolkit-${item.id}`
        return (
          <li key={item.id} className="rounded-lg border border-border p-3 space-y-2" data-toolkit-item={item.id}>
            <div className="flex items-start gap-3">
              {cli && (
                <input
                  id={box}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-accent"
                  checked={installed || selected.has(item.id)}
                  disabled={installed || disabled}
                  onChange={() => onToggle(item.id)}
                />
              )}
              <div className="min-w-0 flex-1">
                <label htmlFor={cli ? box : undefined} className="flex flex-wrap items-center gap-2 text-sm font-medium text-txt">
                  {item.title}
                  {installed && (
                    <span className="flex items-center gap-1 text-xs font-normal text-teal"><Check aria-hidden className="size-3.5" />{t("welcome.toolkitInstalled")}</span>
                  )}
                </label>
                <p className="text-xs text-muted">{item.reason[lang] ?? item.reason.en}</p>
                {item.matched && <p className="text-xs text-accent">{t("welcome.toolkitFits", { signal: t(FIT_KEYS[item.matched]) })}</p>}
              </div>
            </div>
            {failed && (
              <div className="space-y-1" role="alert">
                <p className="flex items-center gap-1 text-xs text-amber-400"><TriangleAlert aria-hidden className="size-3.5" />{t("welcome.toolkitFailed")}</p>
                {result.stderr && <pre className="whitespace-pre-wrap break-all rounded bg-surface2 p-2 font-mono text-xs text-txt">{result.stderr}</pre>}
              </div>
            )}
            {!installed && (failed || !cli) && (
              <div className="space-y-1">
                {failed && <div className="text-xs text-muted">{t("welcome.toolkitRunYourself")}</div>}
                {item.commands.map((c) => <CommandBlock key={c} command={c} />)}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
