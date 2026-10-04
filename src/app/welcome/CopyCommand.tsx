"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

/** The install command with a copy button. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked (insecure origin, permissions): the command stays selectable
    }
  }
  return (
    <div className="inline-flex items-center gap-3 rounded-lg border border-border bg-surface py-2 pl-4 pr-2 font-mono text-sm">
      <span className="select-all text-txt"><span className="text-muted" aria-hidden>$ </span>{command}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${command}`}
        className="rounded-md p-1.5 text-muted hover:bg-surface2 hover:text-txt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" role="status">{copied ? "Copied to clipboard" : ""}</span>
    </div>
  )
}
