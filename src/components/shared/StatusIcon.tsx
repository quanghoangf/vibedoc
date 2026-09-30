import { Circle, CircleCheck, CircleDot, CircleSlash, CircleX, Eye, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"

/** One look per task status, used everywhere a status is shown (the task files keep their emoji; the UI doesn't). */
export const STATUS_META: Record<TaskStatus, { label: string; icon: LucideIcon; text: string; chip: string }> = {
  todo:          { label: "Todo",        icon: Circle,      text: "text-muted",  chip: "border-border2 text-muted" },
  "in-progress": { label: "In progress", icon: CircleDot,   text: "text-amber",  chip: "border-amber/30 bg-amber/5 text-amber" },
  review:        { label: "Review",      icon: Eye,         text: "text-accent", chip: "border-accent/30 bg-accent/5 text-accent" },
  blocked:       { label: "Blocked",     icon: CircleSlash, text: "text-danger", chip: "border-danger/30 bg-danger/5 text-danger" },
  done:          { label: "Done",        icon: CircleCheck, text: "text-teal",   chip: "border-teal/30 bg-teal/5 text-teal" },
  cancelled:     { label: "Cancelled",   icon: CircleX,     text: "text-muted",  chip: "border-border text-muted" },
}

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.todo
  const Icon = meta.icon
  return <Icon aria-label={meta.label} className={cn("size-3.5 shrink-0", meta.text, className)} />
}

/** Icon + label in a small bordered chip (task panel header, lists). */
export function StatusChip({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.todo
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none", meta.chip, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}
