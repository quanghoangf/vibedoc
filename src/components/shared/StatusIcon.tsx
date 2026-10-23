import { useCallback } from "react"
import { Circle, CircleCheck, CircleDot, CirclePause, CircleSlash, CircleX, Eye, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"
import { DEFAULT_STATUSES, type StatusColor, type StatusDef } from "@/lib/statuses"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { statusDefIn, useStatusDefs } from "./status-defs"

/** One look per task status, used everywhere a status is shown (the task files keep their emoji; the UI doesn't). */
export const STATUS_META: Record<TaskStatus, { label: string; icon: LucideIcon; text: string; chip: string }> = {
  todo:          { label: "Todo",        icon: Circle,      text: "text-muted",  chip: "border-border2 text-muted" },
  "in-progress": { label: "In progress", icon: CircleDot,   text: "text-amber",  chip: "border-amber/30 bg-amber/5 text-amber" },
  review:        { label: "Review",      icon: Eye,         text: "text-review", chip: "border-review/30 bg-review/5 text-review" },
  blocked:       { label: "Blocked",     icon: CircleSlash, text: "text-danger", chip: "border-danger/30 bg-danger/5 text-danger" },
  paused:        { label: "Paused",      icon: CirclePause, text: "text-muted",  chip: "border-border2 bg-surface2 text-muted" },
  done:          { label: "Done",        icon: CircleCheck, text: "text-teal",   chip: "border-teal/30 bg-teal/5 text-teal" },
  cancelled:     { label: "Cancelled",   icon: CircleX,     text: "text-muted",  chip: "border-border text-muted" },
}

/** Literal classes per palette color (Tailwind only generates classes it can see). Every hue is a token in globals.css with a
 *  light and a dark ink that clear 4.5:1 on the page and on Graphite. `bar` is a progress segment: review is hatched, never solid. */
export const STATUS_COLOR_CLASS: Record<StatusColor, { text: string; chip: string; bg: string }> = {
  gray:   { text: "text-muted",     chip: "border-border2 text-muted",                         bg: "bg-border2" },
  amber:  { text: "text-amber",     chip: "border-amber/30 bg-amber/5 text-amber",             bg: "bg-amber" },
  review: { text: "text-review",    chip: "border-review/30 bg-review/5 text-review",          bg: "bg-review" },
  accent: { text: "text-accent",    chip: "border-accent/30 bg-accent/5 text-accent",          bg: "bg-accent" },
  red:    { text: "text-danger",    chip: "border-danger/30 bg-danger/5 text-danger",          bg: "bg-danger" },
  slate:  { text: "text-muted",     chip: "border-border2 bg-surface2 text-muted",             bg: "bg-muted/60" },
  teal:   { text: "text-teal",      chip: "border-teal/30 bg-teal/5 text-teal",                bg: "bg-teal" },
  blue:   { text: "text-st-blue",   chip: "border-st-blue/30 bg-st-blue/5 text-st-blue",       bg: "bg-st-blue" },
  pink:   { text: "text-st-pink",   chip: "border-st-pink/30 bg-st-pink/5 text-st-pink",       bg: "bg-st-pink" },
  green:  { text: "text-st-green",  chip: "border-st-green/30 bg-st-green/5 text-st-green",    bg: "bg-st-green" },
  orange: { text: "text-st-orange", chip: "border-st-orange/30 bg-st-orange/5 text-st-orange", bg: "bg-st-orange" },
}

/** One progress mark per task, by category (board lanes, By epic, Table groups, the roadmap, activity sessions).
 *  Done is the only solid "finished" fill; review is hatched in its hue so a bar of review tasks never reads as done. */
export const PROGRESS_MARK: Record<TaskStatus, string> = {
  todo: "bg-border2",
  "in-progress": "bg-amber",
  review: "bar-review",
  blocked: "bg-danger",
  paused: "bg-muted/60",
  done: "bg-teal",
  cancelled: "bg-border",
}

/** "0/4 done · 4 in review": the text and accessible name of every task progress bar (the review part only when there is one). */
export function useProgressLabel(): (statuses: readonly TaskStatus[]) => string {
  const { t } = useT()
  return useCallback((statuses: readonly TaskStatus[]) => {
    const done = statuses.filter((s) => s === "done").length
    const review = statuses.filter((s) => s === "review").length
    const base = t("board.progressDone", { done, total: statuses.length })
    return review ? `${base} · ${t("board.progressInReview", { n: review })}` : base
  }, [t])
}

/** R078: built-in status names in the UI language; STATUS_META's English labels stay for code that isn't UI. */
export const STATUS_KEYS: Record<TaskStatus, MessageKey> = {
  todo: "board.statusTodo",
  "in-progress": "board.statusInProgress",
  review: "board.statusReview",
  blocked: "board.statusBlocked",
  paused: "board.statusPaused",
  done: "board.statusDone",
  cancelled: "board.statusCancelled",
}

/** A def's label: a built-in the project didn't rename is translated, any other label is the project's own words. */
/** A status's label: a built-in still under its default name in the UI language, else as written. */
export function defLabel(def: StatusDef, t: (key: MessageKey) => string): string {
  const builtin = DEFAULT_STATUSES.find((d) => d.id === def.id)
  return builtin && builtin.label === def.label ? t(STATUS_KEYS[def.id as TaskStatus]) : def.label
}

/** A built-in category's name (an epic's derived status, a timeline bar). */
export function useCategoryLabel(): (status: TaskStatus) => string {
  const { t } = useT()
  return (status) => t(STATUS_KEYS[status])
}

/** Label, icon (from the category) and color classes for any status key, built-in or custom. */
export function useStatusMeta(key: string) {
  const { t } = useT()
  const def = statusDefIn(useStatusDefs(), key)
  return { def, label: defLabel(def, t), icon: STATUS_META[def.category].icon, ...STATUS_COLOR_CLASS[def.color] }
}

/** A status key's label (for strings: titles, aria labels). */
export function useStatusLabel(): (key: string) => string {
  const list = useStatusDefs()
  const { t } = useT()
  return useCallback((key: string) => defLabel(statusDefIn(list, key), t), [list, t])
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

/** A task progress bar: one mark per task (PROGRESS_MARK), named for screen readers with the same "0/4 done · 4 in review" text. */
export function ProgressMarks({ statuses, className, markClassName }: { statuses: readonly TaskStatus[]; className?: string; markClassName?: string }) {
  const label = useProgressLabel()(statuses)
  if (!statuses.length) return null
  return (
    <span role="img" aria-label={label} title={label} className={cn("flex min-w-0 gap-0.5", className)}>
      {statuses.map((s, i) => <span key={i} className={cn("h-full flex-1 rounded-full", PROGRESS_MARK[s], markClassName)} />)}
    </span>
  )
}
