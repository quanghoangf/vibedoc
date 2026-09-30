// Task statuses (R055): the seven built-ins plus a project's own, each mapped onto a built-in category.
// Logic (queue, health, dependencies, board buckets) reads the category; the UI reads label and color.
// Files store the status id (`**Status:** 👀 Qa`), so renaming a label never touches task files.
// Pure (no React, no fs). Self-check: `node src/lib/statuses.check.mts`.

import type { TaskStatus } from "./core"

export const BUILTIN_STATUSES: TaskStatus[] = ["todo", "in-progress", "review", "blocked", "paused", "done", "cancelled"]

export const STATUS_ICONS: Record<TaskStatus, string> = {
  todo: "📋",
  "in-progress": "🔨",
  review: "👀",
  blocked: "🚫",
  paused: "⏸️",
  done: "✅",
  cancelled: "❌",
}

export const STATUS_ALIASES: Record<string, TaskStatus> = {
  ready: "todo", planned: "todo", "not started": "todo",
  wip: "in-progress", doing: "in-progress", active: "in-progress", start: "in-progress", started: "in-progress",
  complete: "done", completed: "done", finished: "done", finish: "done",
  block: "blocked",
  "on hold": "paused", "on-hold": "paused", pause: "paused", hold: "paused",
  "in review": "review", reviewing: "review", "needs review": "review",
  cancel: "cancelled", skip: "cancelled",
}

/** Named colors only: Tailwind generates classes it sees literally, so the UI maps these names to fixed classes. */
export const STATUS_COLORS = ["gray", "amber", "accent", "red", "slate", "teal", "blue", "pink", "green", "orange"] as const
export type StatusColor = (typeof STATUS_COLORS)[number]

export interface StatusDef {
  /** Built-in id, or a custom slug ([a-z0-9-]) */
  id: string
  label: string
  color: StatusColor
  category: TaskStatus
}

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: "todo", label: "Todo", color: "gray", category: "todo" },
  { id: "in-progress", label: "In progress", color: "amber", category: "in-progress" },
  { id: "review", label: "Review", color: "accent", category: "review" },
  { id: "blocked", label: "Blocked", color: "red", category: "blocked" },
  { id: "paused", label: "Paused", color: "slate", category: "paused" },
  { id: "done", label: "Done", color: "teal", category: "done" },
  { id: "cancelled", label: "Cancelled", color: "gray", category: "cancelled" },
]

const isBuiltin = (s: string): s is TaskStatus => (BUILTIN_STATUSES as string[]).includes(s)

/** Why an id can't be a custom status, or null when it can. */
export function invalidStatusId(id: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) return "use lowercase letters, digits and dashes"
  if (isBuiltin(id) || id in STATUS_ALIASES || id.replace(/-/g, " ") in STATUS_ALIASES) return `"${id}" already means a built-in status`
  return null
}

/**
 * The project's statuses: every built-in once (its label / color / position may be customised, its category
 * can't), plus valid custom ones. Anything malformed in settings is dropped, never thrown.
 */
export function statusDefs(fromSettings: unknown): StatusDef[] {
  if (!Array.isArray(fromSettings)) return DEFAULT_STATUSES
  const out: StatusDef[] = []
  for (const raw of fromSettings) {
    const r = raw as Partial<StatusDef> | null
    const id = typeof r?.id === "string" ? r.id.trim().toLowerCase() : ""
    if (!id || out.some((d) => d.id === id)) continue
    const builtin = isBuiltin(id)
    const category = builtin ? id : r?.category
    if (!category || !isBuiltin(category) || (!builtin && invalidStatusId(id))) continue
    const base = DEFAULT_STATUSES.find((d) => d.id === (builtin ? id : category))
    out.push({
      id,
      label: typeof r?.label === "string" && r.label.trim() ? r.label.trim() : base?.label ?? id,
      color: STATUS_COLORS.includes(r?.color as StatusColor) ? (r?.color as StatusColor) : base?.color ?? "gray",
      category,
    })
  }
  // built-ins that settings left out keep their default place at the end
  for (const d of DEFAULT_STATUSES) if (!out.some((o) => o.id === d.id)) out.push(d)
  return out
}

export interface ResolvedStatus {
  status: TaskStatus
  /** Set only for a custom status */
  customStatus?: string
  /** The raw value matched nothing (read as todo) */
  unknown?: boolean
}

/** A `**Status:**` value ("👀 Qa", "In review", "done") → category + custom id. */
export function resolveStatus(raw: string, defs: StatusDef[] = DEFAULT_STATUSES): ResolvedStatus {
  const s = raw.toLowerCase().replace(/[📋🔨👀✅🚫❌⏸️]/g, "").trim()
  const key: string = STATUS_ALIASES[s] ?? s
  if (isBuiltin(key)) return { status: key }
  const custom = defs.find((d) => d.id === key || d.id === key.replace(/\s+/g, "-"))
  if (custom && !isBuiltin(custom.id)) return { status: custom.category, customStatus: custom.id }
  return { status: "todo", unknown: true }
}

/** What goes after `**Status:** ` for a status key: built-ins exactly as always ("🔨 In-progress"), custom ids alike ("👀 Qa"). */
export function statusLine(key: string, defs: StatusDef[] = DEFAULT_STATUSES): string {
  const { status, customStatus } = resolveStatus(key, defs)
  const id = customStatus ?? status
  return `${STATUS_ICONS[status]} ${id.charAt(0).toUpperCase()}${id.slice(1)}`
}

/** The key a task shows under: its custom status, else its category. */
export const displayStatus = (t: { status: TaskStatus; customStatus?: string }) => t.customStatus ?? t.status
