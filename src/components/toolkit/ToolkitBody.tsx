"use client"

import type { Ref } from "react"
import { Loader2 } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { ToolkitPicker } from "./ToolkitPicker"
import type { useToolkit } from "./use-toolkit"

/**
 * Loading / error / the picker with its Install button and a polite status line (installing → what happened), so the
 * outcome is announced and still readable under reduced motion. Shared by the welcome step and the chat's toolkit card.
 */
export function ToolkitBody({ tk, onInstall, buttonRef }: { tk: ReturnType<typeof useToolkit>; onInstall: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  const { t, tn } = useT()
  if (tk.failed) return <p className="text-xs text-amber" role="alert">{t("welcome.toolkitLoadFailed")}</p>
  if (tk.items === null) return <p className="text-xs text-muted" aria-busy="true">{t("welcome.toolkitLoading")}</p>
  const outcome = [...tk.results.values()]
  const ok = outcome.filter((r) => r.ok).length
  const status = tk.running
    ? tn("welcome.toolkitInstallingN", tk.installing.size)
    : tk.allInstalled
      ? t("welcome.toolkitAllInstalled")
      : outcome.length
        ? [ok ? tn("welcome.toolkitInstalledN", ok) : "", outcome.length - ok ? tn("welcome.toolkitFailedN", outcome.length - ok) : ""].filter(Boolean).join(" · ")
        : ""
  return (
    <>
      {!tk.cli && <p className="text-xs text-muted">{t("welcome.toolkitNoCli")}</p>}
      <ToolkitPicker items={tk.items} selected={tk.selected} onToggle={tk.toggle} results={tk.results} installing={tk.installing} cli={tk.cli} disabled={tk.running} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {tk.cli && !tk.allInstalled && (
          <button
            ref={buttonRef}
            type="button"
            // while installing it stays focusable (aria-disabled), so focus can come back to it from the dialog
            onClick={() => { if (!tk.running) onInstall() }}
            disabled={!tk.running && tk.picked.length === 0}
            aria-disabled={tk.running || undefined}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors duration-(--duration-fast) hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 aria-disabled:cursor-default aria-disabled:hover:bg-accent"
          >
            {tk.running && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            {tk.running ? t("welcome.toolkitInstalling") : tk.picked.length ? tn("welcome.toolkitInstallN", tk.picked.length) : t("welcome.toolkitInstall")}
          </button>
        )}
        <p role="status" className={tk.allInstalled && !tk.running ? "text-xs text-teal" : "text-xs text-muted"}>{status}</p>
      </div>
    </>
  )
}
