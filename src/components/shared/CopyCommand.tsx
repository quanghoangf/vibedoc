"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { useT } from "@/context/LanguageContext"

/** A command with a copy button: `$ npx vibedoc` for a shell command, or a `/vibedoc:*` slash command (`prompt={false}`). */
export function CopyCommand({ command, prompt = true }: { command: string; prompt?: boolean }) {
  const [copied, setCopied] = useState(false)
  const { t } = useT()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked (insecure origin, permissions): the command stays selectable
    }
  }
  const pill = (
    <div className="inline-flex max-w-full items-center gap-3 rounded-lg border border-border bg-surface py-2 pl-4 pr-2 font-mono text-sm">
      <span className="min-w-0 select-all break-all text-txt">{prompt && <span className="text-muted" aria-hidden>$ </span>}{command}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t("shell.copied") : t("shell.copyThis", { command })}
        className="rounded-md p-1.5 text-muted hover:bg-surface2 hover:text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" role="status">{copied ? t("shell.copiedToClipboard") : ""}</span>
    </div>
  )
  // a slash command says where it runs: it's a Claude Code skill (the vibedoc plugin), not a shell command
  if (prompt) return pill
  return (
    <div className="flex max-w-full flex-col items-center gap-1.5">
      <span className="text-xs text-muted">{t("shell.runInClaudeCode")}</span>
      {pill}
    </div>
  )
}
