"use client"

import { useState } from "react"
import { useT } from "@/context/LanguageContext"
import { ToolkitBody } from "@/components/toolkit/ToolkitBody"
import { ToolkitConfirmDialog } from "@/components/toolkit/ToolkitConfirmDialog"
import { useToolkit } from "@/components/toolkit/use-toolkit"

/** R098: "Pick your toolkit" on the welcome, after the agent row. Install runs only after the confirm dialog. */
export function ToolkitStep() {
  const { t } = useT()
  const tk = useToolkit()
  const [confirm, setConfirm] = useState(false)

  return (
    <section className="w-full space-y-3 rounded-lg border border-border p-4 text-left" aria-labelledby="toolkit-title">
      <div>
        <h2 id="toolkit-title" className="text-sm font-semibold text-txt">{t("welcome.toolkitTitle")}</h2>
        <p className="text-xs text-muted">{t("welcome.toolkitHint")}</p>
      </div>
      <ToolkitBody tk={tk} onInstall={() => setConfirm(true)} />
      {confirm && <ToolkitConfirmDialog items={tk.picked} onConfirm={() => { setConfirm(false); void tk.install() }} onClose={() => setConfirm(false)} />}
    </section>
  )
}
