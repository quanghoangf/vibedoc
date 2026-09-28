// Pure plan model for "plan from the chat": the agent proposes, the user reviews, the server applies.
// No fs here; core.applyPlan() does the writing. Self-check: node src/lib/plan.check.mts
import type { RoadmapItem, RoadmapStatus } from './core'

export interface PlanTask {
  key: string            // stable within the plan, e.g. "t1"; becomes a T id on apply
  title: string
  size?: string          // "S (~1 hr)" | "M (2–3 hrs)" | "L (half day)"
  dependsOn?: string[]   // keys in this plan, or existing task ids ("T030")
  due?: string           // YYYY-MM-DD
  body: string           // full markdown below the meta block: Goal, Context, Scope, Files, …
}
export interface PlanHorizon { key: string; title: string; body?: string }
export interface PlanEpic { key: string; title: string; parent: string; status?: RoadmapStatus; body: string } // parent: existing horizon id or a horizon key
export type Plan =
  | { kind: 'breakdown'; epic: string; tasks: PlanTask[] }
  | { kind: 'roadmap'; horizons: PlanHorizon[]; epics: PlanEpic[] }

export interface PlanContext { roadmap: RoadmapItem[]; taskIds: string[] }

/** A real calendar date "YYYY-MM-DD" (rejects 2026-02-30), else null. Same rule as core's parseDue. */
function isDate(raw: string): boolean {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === raw
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Just enough shape for the chat UI to render a proposal before the server has validated it
 * (the tool_use streams in before its tool_result). Returns null for anything a card can't draw.
 */
export function asRenderablePlan(p: unknown): Plan | null {
  if (!isObj(p)) return null
  const items = (v: unknown, need: string[]) => Array.isArray(v) && v.every(x =>
    isObj(x) && need.every(k => typeof x[k] === 'string') && (x.dependsOn === undefined || Array.isArray(x.dependsOn)))
  if (p.kind === 'breakdown') {
    return typeof p.epic === 'string' && items(p.tasks, ['key', 'title']) && (p.tasks as unknown[]).length > 0
      ? (p as unknown as Plan) : null
  }
  if (p.kind === 'roadmap') {
    const horizons = p.horizons ?? [], epics = p.epics ?? []
    return items(horizons, ['key', 'title']) && items(epics, ['key', 'title', 'parent'])
      ? ({ kind: 'roadmap', horizons, epics } as Plan) : null
  }
  return null
}

/** Every problem with the plan against the current files; [] = valid. */
export function validatePlan(plan: unknown, ctx: PlanContext): string[] {
  if (!isObj(plan)) return ['plan must be an object']
  if (plan.kind === 'roadmap') return validateRoadmapPlan(plan, ctx)
  if (plan.kind !== 'breakdown') return [`plan.kind must be "breakdown" or "roadmap" (got ${JSON.stringify(plan.kind)})`]

  const errors: string[] = []
  const epicId = str(plan.epic).toUpperCase()
  const epic = ctx.roadmap.find(i => i.id === epicId)
  if (!epic) errors.push(`Epic ${JSON.stringify(plan.epic)} not found`)
  else if (!epic.parent) errors.push(`${epic.id} is a horizon, not an epic; pass an epic id`)

  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    errors.push('tasks must be a non-empty array')
    return errors
  }
  const tasks = plan.tasks as unknown[]
  const existing = new Set(ctx.taskIds.map(t => t.toUpperCase()))

  const index = new Map<string, number>()
  tasks.forEach((t, i) => {
    const key = isObj(t) ? str(t.key) : ''
    if (!key) errors.push(`task #${i + 1}: key is required`)
    else if (index.has(key)) errors.push(`duplicate key "${key}"`)
    else index.set(key, i)
  })

  const deps = new Map<string, string[]>() // key → plan keys it depends on
  tasks.forEach((t, i) => {
    if (!isObj(t)) { errors.push(`task #${i + 1} must be an object`); return }
    const label = str(t.key) || `task #${i + 1}`
    if (!str(t.title)) errors.push(`${label}: title is required`)
    if (typeof t.body !== 'string') errors.push(`${label}: body must be a markdown string`)
    if (t.size !== undefined && typeof t.size !== 'string') errors.push(`${label}: size must be a string`)
    if (t.due !== undefined && !(typeof t.due === 'string' && isDate(t.due))) {
      errors.push(`${label}: due must be a date YYYY-MM-DD (got ${JSON.stringify(t.due)})`)
    }
    if (t.dependsOn === undefined) return
    if (!Array.isArray(t.dependsOn)) { errors.push(`${label}: dependsOn must be an array`); return }
    const own: string[] = []
    for (const d of t.dependsOn) {
      const dep = str(d)
      if (index.has(dep)) own.push(dep)
      else if (!existing.has(dep.toUpperCase())) {
        errors.push(`${label}: dependsOn "${String(d)}" is neither a key in this plan nor an existing task`)
      }
    }
    if (str(t.key)) deps.set(str(t.key), own)
  })

  // Cycles (DFS, report each once), then forward references: apply creates in order,
  // so a dependency must come earlier in the list to already have its T id.
  const state = new Map<string, 'open' | 'done'>()
  const cyclic = new Set<string>()
  const visit = (k: string, stack: string[]) => {
    if (state.get(k) === 'done') return
    if (state.get(k) === 'open') {
      const cycle = [...stack.slice(stack.indexOf(k)), k]
      if (!cycle.some(c => cyclic.has(c))) errors.push(`dependency cycle: ${cycle.join(' → ')}`)
      cycle.forEach(c => cyclic.add(c))
      return
    }
    state.set(k, 'open')
    for (const d of deps.get(k) ?? []) visit(d, [...stack, k])
    state.set(k, 'done')
  }
  for (const k of deps.keys()) visit(k, [])
  for (const [k, ds] of deps) {
    if (cyclic.has(k)) continue
    for (const d of ds) {
      if ((index.get(d) ?? 0) > (index.get(k) ?? 0)) errors.push(`${k} depends on ${d}, which comes later; list ${d} first`)
    }
  }
  return errors
}

const STATUSES = ['planned', 'in-progress', 'done']

function validateRoadmapPlan(plan: Record<string, unknown>, ctx: PlanContext): string[] {
  const errors: string[] = []
  const horizons = plan.horizons ?? []
  const epics = plan.epics ?? []
  if (!Array.isArray(horizons)) errors.push('horizons must be an array')
  if (!Array.isArray(epics)) errors.push('epics must be an array')
  if (errors.length > 0) return errors
  const hs = horizons as unknown[]
  const es = epics as unknown[]
  if (hs.length + es.length === 0) return ['a roadmap plan needs at least one horizon or epic']

  const keys = new Set<string>()
  const horizonKeys = new Set<string>()
  const checkKey = (v: unknown, label: string, isHorizon: boolean) => {
    const key = isObj(v) ? str(v.key) : ''
    if (!key) errors.push(`${label}: key is required`)
    else if (keys.has(key)) errors.push(`duplicate key "${key}"`)
    else { keys.add(key); if (isHorizon) horizonKeys.add(key) }
  }
  hs.forEach((h, i) => checkKey(h, `horizon #${i + 1}`, true))
  es.forEach((e, i) => checkKey(e, `epic #${i + 1}`, false))

  // Titles are unique per level (spine, or one horizon), against existing items and within the plan.
  const seen = new Map<string, string>() // "parent\0title" → who has it
  for (const i of ctx.roadmap) seen.set(`${i.parent ?? ''}\0${i.title.trim().toLowerCase()}`, i.id)
  const claimTitle = (parent: string, title: string, label: string) => {
    const k = `${parent}\0${title.toLowerCase()}`
    const other = seen.get(k)
    if (other) errors.push(`${label}: "${title}" already exists ${parent ? `under ${parent}` : 'as a horizon'} (${other})`)
    else seen.set(k, label)
  }

  hs.forEach((h, i) => {
    if (!isObj(h)) { errors.push(`horizon #${i + 1} must be an object`); return }
    const label = str(h.key) || `horizon #${i + 1}`
    const title = str(h.title)
    if (!title) errors.push(`${label}: title is required`)
    else claimTitle('', title, label)
    if (h.body !== undefined && typeof h.body !== 'string') errors.push(`${label}: body must be a markdown string`)
  })

  es.forEach((e, i) => {
    if (!isObj(e)) { errors.push(`epic #${i + 1} must be an object`); return }
    const label = str(e.key) || `epic #${i + 1}`
    const title = str(e.title)
    if (!title) errors.push(`${label}: title is required`)
    if (typeof e.body !== 'string') errors.push(`${label}: body must be a markdown string`)
    if (e.status !== undefined && !STATUSES.includes(e.status as string)) {
      errors.push(`${label}: status must be one of ${STATUSES.join(', ')} (got ${JSON.stringify(e.status)})`)
    }
    const parent = str(e.parent)
    let parentId = ''
    if (!parent) errors.push(`${label}: parent is required (an existing horizon id or a horizon key in this plan)`)
    else if (horizonKeys.has(parent)) parentId = parent
    else if (keys.has(parent)) errors.push(`${label}: parent "${parent}" is an epic in this plan; an epic's parent must be a horizon`)
    else {
      const p = ctx.roadmap.find(r => r.id === parent.toUpperCase())
      if (!p) errors.push(`${label}: parent "${parent}" is neither a horizon key in this plan nor an existing roadmap item`)
      else if (p.parent !== null) errors.push(`${label}: parent ${p.id} is an epic, not a horizon (max depth is 2)`)
      else parentId = p.id
    }
    if (title && parentId) claimTitle(parentId, title, label)
  })
  return errors
}

/** Keep only the selected items. A kept item depending on an unchecked one is an error. */
export function selectPlan(plan: Plan, selected: string[]): { plan: Plan; errors: string[] } {
  if (plan.kind === 'roadmap') return selectRoadmapPlan(plan, selected)
  const errors: string[] = []
  // Trim like validatePlan/applyPlan do, or " t1 " vs "t1" slips past the unchecked-dependency check
  const keys = new Set(plan.tasks.map(t => t.key.trim()))
  const sel = new Set(selected.map(k => k.trim()))
  for (const k of sel) if (!keys.has(k)) errors.push(`unknown key "${k}"`)
  const tasks = plan.tasks.filter(t => sel.has(t.key.trim()))
  if (tasks.length === 0) errors.push('nothing selected')
  for (const t of tasks) {
    for (const d of (t.dependsOn ?? []).map(d => d.trim())) {
      if (keys.has(d) && !sel.has(d)) errors.push(`${t.key.trim()} depends on ${d}, which you unchecked`)
    }
  }
  return { plan: { ...plan, tasks }, errors }
}

function selectRoadmapPlan(plan: Extract<Plan, { kind: 'roadmap' }>, selected: string[]): { plan: Plan; errors: string[] } {
  const errors: string[] = []
  const horizons = plan.horizons ?? []
  const epics = plan.epics ?? []
  const hKeys = new Set(horizons.map(h => h.key))
  const keys = new Set([...hKeys, ...epics.map(e => e.key)])
  const sel = new Set(selected)
  for (const k of sel) if (!keys.has(k)) errors.push(`unknown key "${k}"`)
  const keptH = horizons.filter(h => sel.has(h.key))
  const keptE = epics.filter(e => sel.has(e.key))
  if (keptH.length + keptE.length === 0) errors.push('nothing selected')
  for (const e of keptE) {
    const p = e.parent.trim()
    if (hKeys.has(p) && !sel.has(p)) errors.push(`${e.key} is under ${p}, which you unchecked; check ${p} or uncheck ${e.key}`)
  }
  return { plan: { ...plan, horizons: keptH, epics: keptE }, errors }
}
