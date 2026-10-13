"use client"

import { useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { CommandBlock } from "@/components/connect/ConnectAgentPanel"
import type { ToolkitEntry } from "./ToolkitPicker"

/**
 * R098 S2: names every plugin about to be installed, then the exact commands (a marketplace once, however many of its
 * plugins are picked); nothing runs until Install. Focus starts on Cancel; the caller puts it back on its Install button.
 */
export function ToolkitConfirmDialog({ items, onConfirm, onClose }: { items: ToolkitEntry[]; onConfirm: () => void; onClose: () => void }) {
  const { activeProject } = useApp()
  const { t } = useT()
  const cancel = useRef<HTMLButtonElement>(null)
  const commands = [...new Set(items.flatMap((i) => i.commands))].sort((a, b) => Number(b.includes(" marketplace add ")) - Number(a.includes(" marketplace add ")))
  // Inside the chat modal Radix lets the modal take this Escape too (as TaskRuns): window capture runs before Radix's listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="max-h-[85svh] max-w-lg space-y-3 overflow-y-auto"
        onOpenAutoFocus={(e) => { e.preventDefault(); cancel.current?.focus() }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="text-sm font-semibold text-txt">{t("welcome.toolkitConfirmTitle")}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("welcome.toolkitConfirmBody", { root: activeProject })}</DialogDescription>
        <ul className="divide-y divide-border rounded-md border border-border text-[13px] text-txt">
          {items.map((item) => <li key={item.id} className="px-3 py-1.5">{item.title}</li>)}
        </ul>
        <div className="space-y-1.5">
          {commands.map((c) => <CommandBlock key={c} command={c} />)}
        </div>
        <div className="flex justify-end gap-2">
          <button ref={cancel} type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {t("welcome.toolkitCancel")}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {t("welcome.toolkitConfirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
