"use client"

import { useRef, useState } from "react"
import { useT } from "@/context/LanguageContext"
import { ToolkitBody } from "@/components/toolkit/ToolkitBody"
import { ToolkitConfirmDialog } from "@/components/toolkit/ToolkitConfirmDialog"
import { useToolkit } from "@/components/toolkit/use-toolkit"

/**
 * R098: "Pick your toolkit" on the welcome, after the agent row. Optional; the plugins that fit come ticked. Install runs
 * only after the confirm dialog, and focus comes back to the Install button when it closes.
 */
export function ToolkitStep() {
  const { t } = useT()
  const tk = useToolkit("fits")
  const [confirm, setConfirm] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const close = () => { setConfirm(false); requestAnimationFrame(() => button.current?.focus()) }

  return (
    <section className="w-full space-y-3 rounded-lg border border-border p-4 text-left" aria-labelledby="toolkit-title">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 id="toolkit-title" className="text-sm font-semibold text-txt">{t("welcome.toolkitTitle")}</h2>
          <span className="font-mono text-[11px] text-muted">{t("welcome.toolkitOptional")}</span>
        </div>
        <p className="text-xs text-muted">{t("welcome.toolkitHint")}</p>
      </div>
      <ToolkitBody tk={tk} buttonRef={button} onInstall={() => setConfirm(true)} />
      {confirm && <ToolkitConfirmDialog items={tk.picked} onConfirm={() => { close(); void tk.install() }} onClose={close} />}
    </section>
  )
}
