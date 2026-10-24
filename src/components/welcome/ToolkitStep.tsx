"use client"

import { useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { ToolkitBody } from "@/components/toolkit/ToolkitBody"
import { ToolkitConfirmDialog } from "@/components/toolkit/ToolkitConfirmDialog"
import { useToolkit } from "@/components/toolkit/use-toolkit"

/**
 * R098: "Pick your toolkit" on the welcome, folded behind "Optional: add plugins (N)" so the first screen asks one
 * thing. Closed by default and nothing comes ticked. Install runs only after the confirm dialog, and focus comes back
 * to the Install button when it closes.
 */
export function ToolkitStep() {
  const { t } = useT()
  const tk = useToolkit()
  const [confirm, setConfirm] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const close = () => { setConfirm(false); requestAnimationFrame(() => button.current?.focus()) }
  const addable = tk.items?.filter((i) => !i.installed).length

  return (
    <details className="group/toolkit w-full text-left">
      <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-xs text-muted hover:text-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 transition-transform group-open/toolkit:rotate-90" />
        {addable === undefined ? t("welcome.toolkitSummary") : t("welcome.toolkitSummaryN", { n: addable })}
      </summary>
      <section className="mt-3 space-y-3 rounded-lg border border-border p-4" aria-labelledby="toolkit-title">
        <div>
          <h2 id="toolkit-title" className="text-sm font-semibold text-txt">{t("welcome.toolkitTitle")}</h2>
          <p className="text-xs text-muted">{t("welcome.toolkitHint")}</p>
        </div>
        <ToolkitBody tk={tk} buttonRef={button} onInstall={() => setConfirm(true)} />
        {confirm && <ToolkitConfirmDialog items={tk.picked} onConfirm={() => { close(); void tk.install() }} onClose={close} />}
      </section>
    </details>
  )
}
