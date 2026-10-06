"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { askAgent } from "@/lib/ask-agent"
import { useT } from "@/context/LanguageContext"

interface PlanFromSpecDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Paste a feature spec → the chat agent breaks it into tasks (new epic, existing epic, or loose). */
export function PlanFromSpecDialog({ open, onOpenChange }: PlanFromSpecDialogProps) {
  // Kept after submit (cleared only on Cancel): if the running-agent cap refuses the ask, reopening restores the spec.
  const [spec, setSpec] = useState("")
  const { t } = useT()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!spec.trim()) return
    onOpenChange(false)
    askAgent(`Break down this spec into tasks:\n\n${spec.trim()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">{t("roadmap.planFromSpec")}</DialogTitle>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <textarea
            autoFocus
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder={t("roadmap.pasteSpec")}
            rows={12}
            className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-txt placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="text-xs text-muted">{t("roadmap.planFromSpecHint")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSpec(""); onOpenChange(false) }}>
              {t("board.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!spec.trim()} className="bg-accent text-accent-fg hover:bg-accent/90">
              {t("roadmap.breakDown")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
