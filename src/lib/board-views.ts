// Board views (Notion-style lenses over the same task files): Board · Table · By epic · Timeline, plus saved views.
// Pure (no React, no fs). The live view state rides in the URL; saved views live in `.vibedoc/views.json` (core.ts).
// Self-check: `node src/lib/board-views.check.mts`.

import type { ActivityEvent, Task, TaskStatus } from "./core"

export type ViewKind = "board" | "table" | "epic" | "timeline"

/** Filterable task properties. `ready` = todo with every dependency done; `agent` = a chat working on the task. */
export type FilterProp = "status" | "epic" | "size" | "due" | "deps" | "tests" | "agent" | "ready" | "owner"

/**
 * One filter rule. Ops by prop:
 * - status / epic / size: "is" | "is-not" with `value` = a list (any-of). Epic values are IDs like "R043" ("none" = no epic).
 * - owner: "is" | "is-not" with values "human" | "ai" (any agent) | "none".
 * - due: "before" | "after" with `value[0]` = "YYYY-MM-DD"; "is-set" | "not-set" ignore value.
 * - deps / tests / agent / ready: "is-set" | "not-set" (deps: has dependencies; tests: has a manual test report;
 *   agent: a chat is running / needs you / has a plan to review on the task; ready: see FilterProp).
 */
export interface FilterRule {
  prop: FilterProp
  op: "is" | "is-not" | "before" | "after" | "is-set" | "not-set"
  value: string[]
}

export type SortProp = "status" | "id" | "epic" | "size" | "due" | "title"
export interface SortRule { prop: SortProp; dir: "asc" | "desc" }

export type GroupBy = "status" | "epic" | "size" | "owner" | "none"
/** Table / Board columns and card lines that can be hidden. */
export type PropertyKey = "status" | "epic" | "size" | "due" | "deps" | "tests" | "agent" | "owner"
export type TimelineScale = "active" | "day" | "week"

export interface ViewState {
  kind: ViewKind
  filters: FilterRule[]
  /** Applied in order; ties fall back to ID ascending (numeric). */
  sorts: SortRule[]
  /** Board: the columns are always status, `group` is ignored; Table / By epic / Timeline: sections. */
  group: GroupBy
  /** Board only: swimlanes inside the status columns ("none" = no lanes). */
  subGroup: "epic" | "size" | "none"
  /** Free text over ID + title, case-insensitive. */
  q: string
  /** Visible properties (Table columns, Board card lines). */
  properties: PropertyKey[]
  /** Timeline only. */
  scale: TimelineScale
}

export interface SavedView extends ViewState {
  /** [a-z0-9-]{1,40}; the built-ins are "board" | "table" | "epic" | "timeline". */
  id: string
  name: string
}

/** What `applyView` needs beyond the tasks themselves. */
export interface ViewContext {
  /** Task IDs with an active agent chat (from ChatContext `itemAgents`, keys "task:T062" → "T062"). */
  agentTasks: Set<string>
}

export interface TaskGroup {
  /** Stable key: a status, an epic ID ("none" for no epic), a size letter, or "all". */
  key: string
  /** Display label: "In progress", "Task verification & review", "M", "All tasks". */
  label: string
  /** Epic groups: "R043"; otherwise null. */
  epicId: string | null
  tasks: Task[]
}

/** A task's worked window, from the activity log: first move to in-progress → last move to done (or now if open). */
export interface TimelineBar {
  taskId: string
  epicId: string | null
  startMs: number
  endMs: number
  status: TaskStatus
  /** true while the task is still in progress (endMs = now). */
  open: boolean
}

/** A stretch of the Active-time axis; idle gaps longer than the fold threshold sit between segments. */
export interface AxisSegment { startMs: number; endMs: number }

// Function contract (implemented below):
// DEFAULT_VIEWS: SavedView[]                       the four built-ins, one per ViewKind
// defaultView(kind): ViewState
// epicOf(phase): { id: string | null; title: string }                "R043 — Task …" → { id: "R043", title: "Task …" }
// sizeOf(task): string | null                                         "M (2–3 hrs)" → "M"; "—" / "" → null
// isReady(task, byId): boolean                                        todo and every `dependsOn` ID is done
// applyView(tasks, state, ctx): Task[]                               filter + q + sort (cancelled hidden unless a status filter names it)
// groupTasks(tasks, by): TaskGroup[]                                  stable, meaningful order (status in workflow order: in-progress, review, todo, blocked, done)
// depOutline(tasks): { task: Task; depth: number; alsoAfter: string[] }[]   tasks nested under their first in-epic dependency
// timelineBars(tasks, events, nowMs): TimelineBar[]                   only tasks with at least one task_updated event
// foldAxis(bars, gapMs): AxisSegment[]                                merge bar windows (padded 5%) closer than gapMs
// toParams(state): URLSearchParams                                    compact, omits defaults for the kind
// fromParams(params): ViewState                                       inverse of toParams; unknown values fall back to defaults
// isDirty(state, saved): boolean                                      differs from a saved view (ignores q)

// ─── Defaults ─────────────────────────────────────────────────────────────────

const ALL_PROPERTIES: PropertyKey[] = ["status", "epic", "size", "due", "deps", "tests", "agent", "owner"]
const KINDS: ViewKind[] = ["board", "table", "epic", "timeline"]
const NAMES: Record<ViewKind, string> = { board: "Board", table: "Table", epic: "By epic", timeline: "Timeline" }

export function defaultView(kind: ViewKind): ViewState {
  const base: ViewState = { kind, filters: [], sorts: [], group: "epic", subGroup: "none", q: "", properties: [...ALL_PROPERTIES], scale: "active" }
  if (kind === "board") return { ...base, group: "none", subGroup: "epic", properties: ["epic", "size", "deps", "tests", "agent", "owner"] }
  if (kind === "table") return { ...base, sorts: [{ prop: "status", dir: "asc" }, { prop: "id", dir: "asc" }] }
  return base
}

export const DEFAULT_VIEWS: SavedView[] = KINDS.map((kind) => ({ ...defaultView(kind), id: kind, name: NAMES[kind] }))

// ─── Task fields ──────────────────────────────────────────────────────────────

const STATUS_ORDER: TaskStatus[] = ["in-progress", "review", "todo", "blocked", "paused", "done", "cancelled"]
const STATUS_LABEL: Record<TaskStatus, string> = {
  "in-progress": "In progress", review: "Review", todo: "Todo", blocked: "Blocked", paused: "Paused", done: "Done", cancelled: "Cancelled",
}
const SIZES = ["XS", "S", "M", "L", "XL"]
const cmpId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled"

/** Every `T\d+` in a free-text "Depends on" line (same rule as work-queue `depIds`; inlined so node can run this file). */
function deps(t: Task): string[] {
  return [...new Set((t.dependsOn.match(/\bT\d+\b/gi) ?? []).map((d) => d.toUpperCase()))]
}

/** "human" | "ai" | "none" (same rule as owner.ts `ownerKind`; inlined so node can run this file). */
function ownerKindOf(t: Task): "human" | "ai" | "none" {
  return t.owner === "human" ? "human" : t.owner?.startsWith("ai:") ? "ai" : "none"
}

export function epicOf(phase: string): { id: string | null; title: string } {
  const m = phase.trim().match(/^(R\d+)\b\s*(?:[—–:-]\s*)?(.*)$/i)
  return m ? { id: m[1].toUpperCase(), title: m[2].trim() } : { id: null, title: phase.trim() }
}

export function sizeOf(task: Task): string | null {
  const m = task.size.trim().match(/^(XS|XL|S|M|L)\b/i)
  return m ? m[1].toUpperCase() : null
}

export function isReady(task: Task, byId: Map<string, Task>): boolean {
  return task.status === "todo" && deps(task).every((d) => byId.get(d)?.status === "done")
}

// ─── Filter + sort ────────────────────────────────────────────────────────────

function matches(t: Task, r: FilterRule, ctx: ViewContext, byId: Map<string, Task>): boolean {
  const any = (v: string) => r.value.includes(v)
  const oneOf = (v: string) => (r.op === "is" ? any(v) : r.op === "is-not" ? !any(v) : true)
  const flag = (set: boolean) => (r.op === "is-set" ? set : r.op === "not-set" ? !set : true)
  switch (r.prop) {
    case "status": return oneOf(t.status)
    case "epic": return oneOf(epicOf(t.phase).id ?? "none")
    case "size": return oneOf(sizeOf(t) ?? "none")
    case "due":
      if (r.op === "before") return !!t.due && !!r.value[0] && t.due < r.value[0]
      if (r.op === "after") return !!t.due && !!r.value[0] && t.due > r.value[0]
      return flag(!!t.due)
    case "deps": return flag(deps(t).length > 0)
    case "tests": return flag(t.manualTests !== null)
    case "agent": return flag(ctx.agentTasks.has(t.id))
    case "ready": return flag(isReady(t, byId))
    case "owner": return oneOf(ownerKindOf(t))
  }
}

function compare(a: Task, b: Task, prop: SortProp): number {
  switch (prop) {
    case "status": return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    case "id": return cmpId(a.id, b.id)
    case "title": return a.title.localeCompare(b.title)
    case "epic": {
      const x = epicOf(a.phase).id, y = epicOf(b.phase).id
      return x === y ? 0 : x === null ? 1 : y === null ? -1 : cmpId(x, y)
    }
    case "size": {
      const x = SIZES.indexOf(sizeOf(a) ?? ""), y = SIZES.indexOf(sizeOf(b) ?? "")
      return x === y ? 0 : x < 0 ? 1 : y < 0 ? -1 : x - y
    }
    case "due":
      return a.due === b.due ? 0 : a.due === null ? 1 : b.due === null ? -1 : a.due.localeCompare(b.due)
  }
}

export function applyView(tasks: Task[], state: ViewState, ctx: ViewContext): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const showCancelled = state.filters.some((r) => r.prop === "status" && r.op === "is" && r.value.includes("cancelled"))
  const q = state.q.trim().toLowerCase()
  return tasks
    .filter((t) => showCancelled || t.status !== "cancelled")
    .filter((t) => !q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
    .filter((t) => state.filters.every((r) => matches(t, r, ctx, byId)))
    .sort((a, b) => {
      for (const s of state.sorts) {
        const c = compare(a, b, s.prop)
        // nulls stay last for due / epic / size in either direction
        if (c) return s.dir === "desc" && !nullLast(a, b, s.prop) ? -c : c
      }
      return cmpId(a.id, b.id)
    })
}

/** True when exactly one side has no value for `prop` (that side stays last regardless of direction). */
function nullLast(a: Task, b: Task, prop: SortProp): boolean {
  const v = (t: Task) => (prop === "due" ? t.due : prop === "epic" ? epicOf(t.phase).id : prop === "size" ? (SIZES.includes(sizeOf(t) ?? "") ? "x" : null) : "x")
  return (v(a) === null) !== (v(b) === null)
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export function groupTasks(tasks: Task[], by: GroupBy): TaskGroup[] {
  if (!tasks.length) return []
  if (by === "none") return [{ key: "all", label: "All tasks", epicId: null, tasks }]
  const buckets = new Map<string, Task[]>()
  const keyOf = (t: Task) =>
    by === "status" ? t.status : by === "size" ? sizeOf(t) ?? "none" : by === "owner" ? t.owner ?? "none" : epicOf(t.phase).id ?? "none"
  for (const t of tasks) {
    const k = keyOf(t)
    const list = buckets.get(k)
    if (list) list.push(t)
    else buckets.set(k, [t])
  }
  const group = (key: string, label: string, epicId: string | null = null): TaskGroup => ({ key, label, epicId, tasks: buckets.get(key) ?? [] })
  if (by === "status") return STATUS_ORDER.filter((s) => buckets.has(s)).map((s) => group(s, STATUS_LABEL[s]))
  if (by === "size") return [...SIZES, "none"].filter((s) => buckets.has(s)).map((s) => group(s, s === "none" ? "No size" : s))
  if (by === "owner") {
    // human, then each agent by name, then unowned
    const agents = [...buckets.keys()].filter((k) => k.startsWith("ai:")).sort()
    return ["human", ...agents, "none"].filter((k) => buckets.has(k))
      .map((k) => group(k, k === "human" ? "Human" : k === "none" ? "No owner" : `${k.slice(3)} (AI)`))
  }

  // epic: open work first (by lowest open task ID), then the rest by epic ID descending; "none" last
  const lowestOpen = (k: string) => (buckets.get(k) ?? []).filter(isOpen).map((t) => t.id).sort(cmpId)[0] ?? null
  const keys = [...buckets.keys()].filter((k) => k !== "none").sort((x, y) => {
    const ox = lowestOpen(x), oy = lowestOpen(y)
    if (ox && oy) return cmpId(ox, oy) || cmpId(x, y)
    if (ox || oy) return ox ? -1 : 1
    return cmpId(y, x)
  })
  const out = keys.map((k) => {
    const title = (buckets.get(k) ?? []).map((t) => epicOf(t.phase).title).find(Boolean)
    return group(k, title || k, k)
  })
  if (buckets.has("none")) out.push(group("none", "No epic"))
  return out
}

// ─── Dependency outline ───────────────────────────────────────────────────────

const MAX_DEPTH = 4

export function depOutline(tasks: Task[]): { task: Task; depth: number; alsoAfter: string[] }[] {
  const inList = new Set(tasks.map((t) => t.id))
  const parent = new Map<string, string>()
  for (const t of tasks) {
    const p = deps(t).find((d) => d !== t.id && inList.has(d))
    if (p) parent.set(t.id, p)
  }
  const children = new Map<string, Task[]>()
  for (const t of tasks) {
    const p = parent.get(t.id)
    if (p) children.set(p, [...(children.get(p) ?? []), t])
  }
  const out: { task: Task; depth: number; alsoAfter: string[] }[] = []
  const seen = new Set<string>()
  const visit = (t: Task, depth: number, under: string | null) => {
    if (seen.has(t.id)) return
    seen.add(t.id)
    out.push({ task: t, depth: Math.min(depth, MAX_DEPTH), alsoAfter: deps(t).filter((d) => d !== under && d !== t.id) })
    for (const c of children.get(t.id) ?? []) visit(c, depth + 1, t.id)
  }
  for (const t of tasks) if (!parent.has(t.id)) visit(t, 0, null)
  // cycle members never reach a root: surface each as a root in input order
  for (const t of tasks) visit(t, 0, null)
  return out
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function timelineBars(tasks: Task[], events: ActivityEvent[], nowMs: number): TimelineBar[] {
  const byTask = new Map<string, { ms: number; status?: TaskStatus }[]>()
  for (const e of events) {
    if (e.type !== "task_updated" || !e.taskId) continue
    const ms = Date.parse(e.timestamp)
    if (Number.isNaN(ms)) continue
    const list = byTask.get(e.taskId) ?? []
    list.push({ ms, status: e.taskStatus })
    byTask.set(e.taskId, list)
  }
  const bars: TimelineBar[] = []
  for (const t of tasks) {
    const evs = byTask.get(t.id)?.sort((a, b) => a.ms - b.ms)
    if (!evs?.length) continue
    const startMs = (evs.find((e) => e.status === "in-progress") ?? evs[0]).ms
    const last = evs[evs.length - 1].ms
    const doneAt = evs.filter((e) => e.status === "done").pop()?.ms
    // ponytail: cancelled closes at its last event rather than stretching to now
    const open = t.status !== "done" && t.status !== "cancelled"
    const endMs = t.status === "done" ? doneAt ?? last : open ? nowMs : last
    bars.push({ taskId: t.id, epicId: epicOf(t.phase).id, startMs, endMs: Math.max(endMs, startMs), status: t.status, open })
  }
  return bars
}

const MIN_PAD_MS = 60_000

export function foldAxis(bars: TimelineBar[], gapMs: number): AxisSegment[] {
  const wins = bars
    .map((b) => {
      const pad = Math.max((b.endMs - b.startMs) * 0.05, MIN_PAD_MS)
      return { startMs: b.startMs - pad, endMs: b.endMs + pad }
    })
    .sort((a, b) => a.startMs - b.startMs)
  const out: AxisSegment[] = []
  for (const w of wins) {
    const cur = out[out.length - 1]
    if (cur && w.startMs - cur.endMs < gapMs) cur.endMs = Math.max(cur.endMs, w.endMs)
    else out.push({ ...w })
  }
  return out
}

// ─── URL state ────────────────────────────────────────────────────────────────

const FILTER_PROPS: FilterProp[] = ["status", "epic", "size", "due", "deps", "tests", "agent", "ready", "owner"]
const FILTER_OPS: FilterRule["op"][] = ["is", "is-not", "before", "after", "is-set", "not-set"]
const SORT_PROPS: SortProp[] = ["status", "id", "epic", "size", "due", "title"]
const GROUPS: GroupBy[] = ["status", "epic", "size", "owner", "none"]
const SUBGROUPS: ViewState["subGroup"][] = ["epic", "size", "none"]
const SCALES: TimelineScale[] = ["active", "day", "week"]

const pick = <T extends string>(allowed: readonly T[], v: string | null, fallback: T): T =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const sortsStr = (s: SortRule[]) => s.map((r) => (r.dir === "desc" ? "-" : "") + r.prop).join(",")
const filtersStr = (f: FilterRule[]) =>
  f.map((r) => [r.prop, r.op, ...(r.value.length ? [r.value.map(encodeURIComponent).join("|")] : [])].join(":")).join(";")

export function toParams(state: ViewState): URLSearchParams {
  const d = defaultView(state.kind)
  const p = new URLSearchParams()
  if (state.kind !== "board") p.set("view", state.kind)
  if (state.group !== d.group) p.set("g", state.group)
  if (state.subGroup !== d.subGroup) p.set("sg", state.subGroup)
  if (sortsStr(state.sorts) !== sortsStr(d.sorts)) p.set("s", sortsStr(state.sorts))
  if (state.filters.length) p.set("f", filtersStr(state.filters))
  if (state.q) p.set("q", state.q)
  if (state.properties.join(",") !== d.properties.join(",")) p.set("p", state.properties.join(","))
  if (state.scale !== d.scale) p.set("sc", state.scale)
  return p
}

export function fromParams(params: URLSearchParams): ViewState {
  const kind = pick(KINDS, params.get("view"), "board")
  const d = defaultView(kind)
  const s = params.get("s")
  const f = params.get("f")
  const p = params.get("p")
  return {
    kind,
    group: pick(GROUPS, params.get("g"), d.group),
    subGroup: pick(SUBGROUPS, params.get("sg"), d.subGroup),
    sorts: s === null ? d.sorts : s.split(",").filter(Boolean).flatMap((tok): SortRule[] => {
      const desc = tok.startsWith("-")
      const prop = desc ? tok.slice(1) : tok
      return SORT_PROPS.includes(prop as SortProp) ? [{ prop: prop as SortProp, dir: desc ? "desc" : "asc" }] : []
    }),
    filters: !f ? [] : f.split(";").flatMap((tok): FilterRule[] => {
      const [prop, op, ...rest] = tok.split(":")
      if (!FILTER_PROPS.includes(prop as FilterProp) || !FILTER_OPS.includes(op as FilterRule["op"])) return []
      const raw = rest.join(":")
      let value: string[] = []
      try { value = rest.length ? raw.split("|").map(decodeURIComponent) : [] } catch { return [] }
      return [{ prop: prop as FilterProp, op: op as FilterRule["op"], value }]
    }),
    q: params.get("q") ?? "",
    properties: p === null ? d.properties : [...new Set(p.split(",").filter((k): k is PropertyKey => ALL_PROPERTIES.includes(k as PropertyKey)))],
    scale: pick(SCALES, params.get("sc"), d.scale),
  }
}

export function isDirty(state: ViewState, saved: SavedView): boolean {
  const norm = (v: ViewState) =>
    JSON.stringify([v.kind, v.filters, v.sorts, v.group, v.subGroup, [...v.properties].sort(), v.scale])
  return norm(state) !== norm(saved)
}
