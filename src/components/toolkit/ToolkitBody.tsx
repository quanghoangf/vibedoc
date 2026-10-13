"use client"

import { Loader2 } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { ToolkitPicker } from "./ToolkitPicker"
import type { useToolkit } from "./use-toolkit"

/** Loading / error / the picker with its Install button; shared by the welcome step and the chat's toolkit card. */
export function ToolkitBody({ tk, onInstall }: { tk: ReturnType<typeof useToolkit>; onInstall: () => void }) {
  const { t } = useT()
  if (tk.failed) return <p className="text-xs text-amber-400" role="alert">{t("welcome.toolkitLoadFailed")}</p>
  if (tk.items === null) return <p className="text-xs text-muted" aria-busy="true">{t("welcome.toolkitLoading")}</p>
  return (
    <>
      {!tk.cli && <p className="text-xs text-muted">{t("welcome.toolkitNoCli")}</p>}
      <ToolkitPicker items={tk.items} selected={tk.selected} onToggle={tk.toggle} results={tk.results} cli={tk.cli} disabled={tk.running} />
      {tk.allInstalled ? (
        <p className="text-xs text-teal" role="status">{t("welcome.toolkitAllInstalled")}</p>
      ) : tk.cli && (
        <button
          type="button"
          onClick={onInstall}
          disabled={tk.running || tk.picked.length === 0}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
        >
          {tk.running && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          {t(tk.running ? "welcome.toolkitInstalling" : "welcome.toolkitInstall")}
        </button>
      )}
    </>
  )
}
