"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { CommandBlock } from "@/components/connect/ConnectAgentPanel"
import type { ToolkitEntry } from "./ToolkitPicker"

/** R098 S2: names every plugin about to be installed with its exact commands; nothing runs until Install. */
export function ToolkitConfirmDialog({ items, onConfirm, onClose }: { items: ToolkitEntry[]; onConfirm: () => void; onClose: () => void }) {
  const { activeProject } = useApp()
  const { t } = useT()
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[85svh] max-w-lg space-y-3 overflow-y-auto">
        <DialogTitle className="text-sm font-semibold text-txt">{t("welcome.toolkitConfirmTitle")}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("welcome.toolkitConfirmBody", { root: activeProject })}</DialogDescription>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="space-y-1">
              <div className="text-sm font-medium text-txt">{item.title}</div>
              {item.commands.map((c) => <CommandBlock key={c} command={c} />)}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-txt">
            {t("welcome.toolkitCancel")}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90">
            {t("welcome.toolkitConfirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
