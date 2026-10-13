"use client"

import { useId } from "react"
import { Check, Loader2, TriangleAlert } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
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
 * R098: the ranked plugin list as one ruled list, a reason under each title. Plugins Claude Code already had fold into
 * one "Already installed" line; a row installed from here keeps its place and turns ✓. A failed install shows the real
 * error and the commands to copy. Without the CLI every row shows its commands instead of a checkbox.
 * Shared by the welcome step and the chat's toolkit card.
 */
export function ToolkitPicker({ items, selected, onToggle, results, installing, cli, disabled }: {
  items: ToolkitEntry[]
  selected: Set<string>
  onToggle: (id: string) => void
  results: Map<string, ToolkitResult>
  installing: Set<string>
  cli: boolean
  disabled?: boolean
}) {
  const { t, lang } = useT()
  const uid = useId() // the welcome step and a chat card can be on screen together
  const had = items.filter((i) => i.installed && !results.has(i.id))
  const rows = items.filter((i) => !had.includes(i))
  return (
    <div className="space-y-2 text-left">
      {rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((item) => {
            const result = results.get(item.id)
            const done = item.installed || result?.ok === true
            const failed = result && !result.ok
            const busy = installing.has(item.id)
            const box = `${uid}-${item.id}`
            return (
              <li key={item.id} className="space-y-2 py-2.5 first:pt-0 last:pb-0" data-toolkit-item={item.id}>
                <div className="flex items-start gap-3">
                  {cli && (
                    <span className="relative mt-0.5 flex size-4 shrink-0">
                      <input
                        id={box}
                        type="checkbox"
                        aria-describedby={`${box}-why`}
                        className="peer size-4 cursor-pointer appearance-none rounded-sm border border-muted bg-bg transition-colors duration-(--duration-fast) checked:border-accent checked:bg-accent hover:border-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
                        checked={done || selected.has(item.id)}
                        disabled={done || disabled}
                        onChange={() => onToggle(item.id)}
                      />
                      <Check strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-3 text-accent-fg opacity-0 peer-checked:opacity-100" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <label htmlFor={cli ? box : undefined} className="text-[13px] font-medium text-txt">{item.title}</label>
                      {item.matched && (
                        <span className="font-mono text-[11px] text-muted">{t("welcome.toolkitFits", { signal: t(FIT_KEYS[item.matched]) })}</span>
                      )}
                      {busy && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
                          <Loader2 aria-hidden className="size-3 animate-spin" />{t("welcome.toolkitRowInstalling")}
                        </span>
                      )}
                      {done && (
                        <span className="flex items-center gap-1 text-[11px] text-teal"><Check aria-hidden className="size-3" />{t("welcome.toolkitInstalled")}</span>
                      )}
                    </div>
                    <p id={`${box}-why`} className="text-xs text-muted">{item.reason[lang] ?? item.reason.en}</p>
                  </div>
                </div>
                {failed && (
                  <div className="space-y-1.5" role="alert">
                    <p className="flex items-center gap-1 text-xs text-amber"><TriangleAlert aria-hidden className="size-3.5" />{t("welcome.toolkitFailed")}</p>
                    {result.stderr && (
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface2 p-2 font-mono text-[11px] text-txt">{result.stderr}</pre>
                    )}
                  </div>
                )}
                {!done && (failed || !cli) && (
                  <div className="space-y-1">
                    {failed && <div className="text-xs text-muted">{t("welcome.toolkitRunYourself")}</div>}
                    {item.commands.map((c) => <CommandBlock key={c} command={c} />)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {had.length > 0 && (
        <p className={cn("flex items-start gap-1.5 text-xs text-muted", rows.length > 0 && "border-t border-border pt-2")} data-toolkit-had>
          <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-teal" />
          <span>{t("welcome.toolkitAlreadyInstalled", { list: had.map((i) => i.title).join(", ") })}</span>
        </p>
      )}
    </div>
  )
}
