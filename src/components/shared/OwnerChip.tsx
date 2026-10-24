import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { ownerKind, workerChatId } from "@/lib/owner"
import { useT } from "@/context/LanguageContext"
import { useOwnerLabel } from "./owner-label"

/** Who is in charge: a person icon for "human", a bot + agent name for "ai:<agent>". Nothing when unset. */
/** `iconOnly`: the name goes to the tooltip and screen readers (dense rows) */
export function OwnerChip({ owner, className, iconOnly = false }: { owner: string | null; className?: string; iconOnly?: boolean }) {
  const { t } = useT()
  const ownerLabel = useOwnerLabel()
  const kind = ownerKind(owner)
  if (kind === "none") return null
  const Icon = kind === "ai" ? Bot : User
  return (
    // a worker's label hides its raw id (`ai:worker-<chatId>`); the tooltip keeps it
    <span title={t("board.ownerIs", { name: workerChatId(owner) ? `${ownerLabel(owner)} (${owner?.slice(3)})` : ownerLabel(owner) })} className={cn("inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap text-[11px] text-muted", className)}>
      <Icon className={cn("size-3.5 shrink-0", kind === "ai" && "text-accent")} aria-hidden />
      {/* one line, cut with an ellipsis ("Worker (removed)" never wraps on a card); the title has the full name */}
      {iconOnly ? <span className="sr-only">{ownerLabel(owner)}</span> : <span className="min-w-0 truncate">{ownerLabel(owner)}</span>}
    </span>
  )
}
