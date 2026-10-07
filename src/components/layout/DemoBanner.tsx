"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

const focusRing = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
const COMMANDS = ["cd your-project", "npx vibedoc"]

/** `vibedoc --demo` (R085): says this is a throwaway sample, and how to run VibeDoc on the user's own repo. */
export function DemoBanner() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <div role="region" aria-label={t("shell.playgroundBadge")} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-accent/10 px-4 py-2 text-xs">
      <span className="rounded bg-accent px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-bg">{t("shell.playgroundBadge")}</span>
      <span className="min-w-0 flex-1 text-muted">{t("shell.playgroundNote")}</span>
      <button type="button" onClick={() => setOpen(true)} className={cn("rounded-md border border-accent/40 px-2.5 py-1 font-medium text-txt hover:bg-accent/15", focusRing)}>
        {t("shell.playgroundUseMine")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-border2 bg-surface text-txt">
          <DialogTitle className="text-sm font-semibold">{t("shell.playgroundUseMine")}</DialogTitle>
          <DialogDescription className="text-xs text-muted">{t("shell.playgroundUseMineBody")}</DialogDescription>
          <div className="flex flex-col gap-2">
            {COMMANDS.map((c) => <CommandRow key={c} command={c} />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CommandRow({ command }: { command: string }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.warn("[vibedoc] could not copy:", e) // the command stays selectable
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-sm">
      <code className="min-w-0 flex-1 select-all text-accent"><span aria-hidden className="text-muted">$ </span>{command}</code>
      <button type="button" onClick={copy} aria-label={copied ? t("shell.playgroundCopied") : t("shell.playgroundCopy", { command })} className={cn("grid size-6 place-items-center rounded text-muted hover:text-txt", focusRing)}>
        {copied ? <Check aria-hidden className="size-3.5 text-teal" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
    </div>
  )
}
