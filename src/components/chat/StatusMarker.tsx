"use client"

import { Loader2, Map as MapIcon, SquareCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { STATUS_LABEL, type Attach, type ChatStatus } from "@/lib/chats"

/**
 * Running = spinner; needs answers = pulsing amber dot; review = pulsing accent diamond; error = red dot; idle = hollow dot.
 * Shape and motion differ, not only hue: the accent can be green, close to the teal used for done.
 */
export function StatusMarker({ status, showIdle = false, label, className }: { status: ChatStatus; showIdle?: boolean; label?: string; className?: string }) {
  if (status === "idle" && !showIdle) return null
  const text = label ?? STATUS_LABEL[status]
  return (
    <span role="img" aria-label={text} title={text} className={cn("inline-flex size-3 shrink-0 items-center justify-center", className)}>
      {status === "running" ? (
        <Loader2 className="size-3 animate-spin text-accent" />
      ) : (
        <span
          className={cn(
            "size-1.5",
            status === "review" ? "size-2 rotate-45 rounded-[1px] bg-accent animate-pulse-dot" : "rounded-full",
            status === "needs-answer" && "bg-amber animate-pulse-dot",
            status === "error" && "bg-danger",
            status === "idle" && "border border-muted/60",
          )}
        />
      )}
    </span>
  )
}

/** "R004" / "T055" with an epic/task icon. Rendered as a span; the caller decides whether it's a link. */
export function AttachLabel({ attach, className }: { attach: Attach; className?: string }) {
  const Icon = attach.kind === "epic" ? MapIcon : SquareCheck
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[10px] leading-none", className)}>
      <Icon className="size-3" />
      {attach.id}
    </span>
  )
}

export function attachHref(a: Attach): string {
  return a.kind === "epic" ? `/roadmap?item=${a.id}` : `/board?task=${a.id}`
}
