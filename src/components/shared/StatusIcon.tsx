import { Circle, CircleCheck, CircleDot, CirclePause, CircleSlash, CircleX, Eye, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"
import type { StatusColor } from "@/lib/statuses"
import { statusDefIn, useStatusDefs } from "./status-defs"

/** One look per task status, used everywhere a status is shown (the task files keep their emoji; the UI doesn't). */
export const STATUS_META: Record<TaskStatus, { label: string; icon: LucideIcon; text: string; chip: string }> = {
  todo:          { label: "Todo",        icon: Circle,      text: "text-muted",  chip: "border-border2 text-muted" },
  "in-progress": { label: "In progress", icon: CircleDot,   text: "text-amber",  chip: "border-amber/30 bg-amber/5 text-amber" },
  review:        { label: "Review",      icon: Eye,         text: "text-accent", chip: "border-accent/30 bg-accent/5 text-accent" },
  blocked:       { label: "Blocked",     icon: CircleSlash, text: "text-danger", chip: "border-danger/30 bg-danger/5 text-danger" },
  paused:        { label: "Paused",      icon: CirclePause, text: "text-muted",  chip: "border-border2 bg-surface2 text-muted" },
  done:          { label: "Done",        icon: CircleCheck, text: "text-teal",   chip: "border-teal/30 bg-teal/5 text-teal" },
  cancelled:     { label: "Cancelled",   icon: CircleX,     text: "text-muted",  chip: "border-border text-muted" },
}

/** Literal classes per palette color (Tailwind only generates classes it can see). Extra hues take -600 ink on paper, -400 on dark (4.5:1 both ways). */
export const STATUS_COLOR_CLASS: Record<StatusColor, { text: string; chip: string; bg: string }> = {
  gray:   { text: "text-muted",      chip: "border-border2 text-muted",                       bg: "bg-border2" },
  amber:  { text: "text-amber",      chip: "border-amber/30 bg-amber/5 text-amber",           bg: "bg-amber" },
  accent: { text: "text-accent",     chip: "border-accent/30 bg-accent/5 text-accent",        bg: "bg-accent" },
  red:    { text: "text-danger",     chip: "border-danger/30 bg-danger/5 text-danger",        bg: "bg-danger" },
  slate:  { text: "text-muted",      chip: "border-border2 bg-surface2 text-muted",           bg: "bg-muted/60" },
  teal:   { text: "text-teal",       chip: "border-teal/30 bg-teal/5 text-teal",              bg: "bg-teal" },
  blue:   { text: "text-blue-600 dark:text-blue-400", chip: "border-blue-600/30 bg-blue-600/5 text-blue-600 dark:border-blue-400/30 dark:bg-blue-400/5 dark:text-blue-400", bg: "bg-blue-500 dark:bg-blue-400" },
  pink:   { text: "text-pink-600 dark:text-pink-400", chip: "border-pink-600/30 bg-pink-600/5 text-pink-600 dark:border-pink-400/30 dark:bg-pink-400/5 dark:text-pink-400", bg: "bg-pink-500 dark:bg-pink-400" },
  green:  { text: "text-green-600 dark:text-green-400", chip: "border-green-600/30 bg-green-600/5 text-green-600 dark:border-green-400/30 dark:bg-green-400/5 dark:text-green-400", bg: "bg-green-500 dark:bg-green-400" },
  orange: { text: "text-orange-600 dark:text-orange-400", chip: "border-orange-600/30 bg-orange-600/5 text-orange-600 dark:border-orange-400/30 dark:bg-orange-400/5 dark:text-orange-400", bg: "bg-orange-500 dark:bg-orange-400" },
}

/** Label, icon (from the category) and color classes for any status key, built-in or custom. */
export function useStatusMeta(key: string) {
  const def = statusDefIn(useStatusDefs(), key)
  return { def, label: def.label, icon: STATUS_META[def.category].icon, ...STATUS_COLOR_CLASS[def.color] }
}

/** A status key's label (for strings: titles, aria labels). */
export function useStatusLabel(): (key: string) => string {
  const list = useStatusDefs()
  return (key) => statusDefIn(list, key).label
}

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const meta = useStatusMeta(status)
  const Icon = meta.icon
  return <Icon aria-label={meta.label} className={cn("size-3.5 shrink-0", meta.text, className)} />
}

/** Icon + label in a small bordered chip (task panel header, lists). */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const meta = useStatusMeta(status)
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none", meta.chip, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}
