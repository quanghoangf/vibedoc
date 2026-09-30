import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { ownerKind, ownerLabel } from "@/lib/owner"

/** Who is in charge: a person icon for "human", a bot + agent name for "ai:<agent>". Nothing when unset. */
export function OwnerChip({ owner, className }: { owner: string | null; className?: string }) {
  const kind = ownerKind(owner)
  if (kind === "none") return null
  const Icon = kind === "ai" ? Bot : User
  return (
    <span title={`Owner: ${ownerLabel(owner)}`} className={cn("inline-flex items-center gap-1 text-[11px] text-muted", className)}>
      <Icon className={cn("size-3.5 shrink-0", kind === "ai" && "text-accent")} aria-hidden />
      {ownerLabel(owner)}
    </span>
  )
}
