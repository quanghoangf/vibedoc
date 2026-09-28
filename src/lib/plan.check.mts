// Self-check for the plan model. Run: node src/lib/plan.check.mts
import assert from 'node:assert/strict'
import type { RoadmapItem } from './core'
import { asRenderablePlan, planTarget, selectPlan, validatePlan, type Plan, type PlanTask } from './plan.ts'

const item = (id: string, parent: string | null): RoadmapItem =>
  ({ id, title: id, parent, status: 'planned', order: 10, tasks: [], due: null, body: '', file: `${id}.md` })
const ctx = { roadmap: [item('R001', null), item('R002', 'R001')], taskIds: ['T030'] }
const t = (key: string, dependsOn?: string[], extra: Partial<PlanTask> = {}): PlanTask =>
  ({ key, title: `Task ${key}`, body: '## Goal\nx', ...(dependsOn ? { dependsOn } : {}), ...extra })
const plan = (tasks: PlanTask[], epic = 'R002'): Plan => ({ kind: 'breakdown', epic, tasks })

// valid: plan keys, existing ids (any case), due
assert.deepEqual(validatePlan(plan([t('t1', ['t030']), t('t2', ['t1', 'T030'], { due: '2026-10-01' })]), ctx), [])

// epic: unknown, horizon
assert.match(validatePlan(plan([t('t1')], 'R999'), ctx).join(), /not found/)
assert.match(validatePlan(plan([t('t1')], 'R001'), ctx).join(), /horizon/)

// shape: kind, empty tasks, missing key/title/body, duplicate keys, bad due
assert.match(validatePlan({ kind: 'nope' }, ctx).join(), /kind/)
assert.match(validatePlan(plan([]), ctx).join(), /non-empty/)
const shape = validatePlan({ kind: 'breakdown', epic: 'R002', tasks: [{ key: '', title: 'a', body: '' }, { key: 't1', title: ' ' }, t('t1'), t('t2', [], { due: '2026-02-30' })] }, ctx)
assert.ok(shape.some(e => /#1: key is required/.test(e)))
assert.ok(shape.some(e => /t1: title is required/.test(e)))
assert.ok(shape.some(e => /t1: body must be/.test(e)))
assert.ok(shape.some(e => /duplicate key "t1"/.test(e)))
assert.ok(shape.some(e => /t2: due must be/.test(e)))

// dependencies: unknown key, cycle (reported once), self-cycle, forward reference
assert.match(validatePlan(plan([t('t1', ['t9'])]), ctx).join(), /t9.*neither/)
const cyc = validatePlan(plan([t('t1', ['t2']), t('t2', ['t1'])]), ctx)
assert.deepEqual(cyc, ['dependency cycle: t1 → t2 → t1'])
assert.deepEqual(validatePlan(plan([t('t1', ['t1'])]), ctx), ['dependency cycle: t1 → t1'])
assert.deepEqual(validatePlan(plan([t('t1', ['t2']), t('t2')]), ctx), ['t1 depends on t2, which comes later; list t2 first'])

// every problem listed at once
assert.equal(validatePlan(plan([t('t1', ['zz']), t('t2', ['t3']), t('t3', ['t2'])], 'R001'), ctx).length, 3)

// selection
const p3 = plan([t('t1'), t('t2', ['t1']), t('t3', ['T030'])])
const all = selectPlan(p3, ['t1', 't2', 't3'])
assert.deepEqual(all.errors, [])
assert.equal(all.plan.kind === 'breakdown' && all.plan.tasks.length, 3)
const some = selectPlan(p3, ['t1', 't3'])
assert.deepEqual(some.errors, [])
assert.deepEqual(some.plan.kind === 'breakdown' && some.plan.tasks.map(x => x.key), ['t1', 't3'])
assert.deepEqual(selectPlan(p3, ['t2']).errors, ['t2 depends on t1, which you unchecked'])
assert.deepEqual(selectPlan(p3, []).errors, ['nothing selected'])
assert.deepEqual(selectPlan(p3, ['t1', 'x']).errors, ['unknown key "x"'])

// ── roadmap ──
const rctx = { roadmap: [item('R001', null), item('R002', 'R001'), { ...item('R003', null), title: 'Next' }, { ...item('R004', 'R003'), title: 'Billing' }], taskIds: [] }
const rp = (horizons: unknown[], epics: unknown[]) => ({ kind: 'roadmap', horizons, epics })
const h = (key: string, title = `H ${key}`) => ({ key, title })
const e = (key: string, parent: string, title = `E ${key}`) => ({ key, title, parent, body: 'Outcome.\n\n**In scope:** x' })

// valid: new horizons + epics, epic under an existing horizon (any case), horizons only
assert.deepEqual(validatePlan(rp([h('h1'), h('h2')], [e('e1', 'h1'), e('e2', 'h2'), e('e3', 'h1')]), rctx), [])
assert.deepEqual(validatePlan(rp([], [e('e1', 'r003')]), rctx), [])
assert.deepEqual(validatePlan({ kind: 'roadmap', horizons: [h('h1')] }, rctx), [])

// depth 3: parent is an existing epic, or an epic key in the plan
assert.deepEqual(validatePlan(rp([], [e('e1', 'R002')]), rctx), ['e1: parent R002 is an epic, not a horizon (max depth is 2)'])
assert.match(validatePlan(rp([h('h1')], [e('e1', 'h1'), e('e2', 'e1')]), rctx).join(), /e2: parent "e1" is an epic in this plan/)
assert.match(validatePlan(rp([], [e('e1', 'zz')]), rctx).join(), /e1: parent "zz" is neither/)
assert.match(validatePlan(rp([], [{ key: 'e1', title: 'x', body: '' }]), rctx).join(), /parent is required/)

// keys unique across horizons and epics; shape
assert.match(validatePlan(rp([h('k')], [e('k', 'R001')]), rctx).join(), /duplicate key "k"/)
assert.match(validatePlan(rp([], []), rctx).join(), /at least one/)
assert.match(validatePlan({ kind: 'roadmap', horizons: 'x', epics: [] }, rctx).join(), /horizons must be an array/)
assert.match(validatePlan(rp([], [{ ...e('e1', 'R001'), status: 'wip' }]), rctx).join(), /status must be/)

// titles: no duplicate in the same horizon (case-insensitive), existing or within the plan
assert.deepEqual(validatePlan(rp([], [e('e1', 'R003', 'billing ')]), rctx), ['e1: "billing" already exists under R003 (R004)'])
assert.deepEqual(validatePlan(rp([], [e('e1', 'R001', 'Billing')]), rctx), []) // other horizon: fine
assert.match(validatePlan(rp([h('h1')], [e('e1', 'h1', 'A'), e('e2', 'h1', 'a')]), rctx).join(), /e2: "a" already exists/)
assert.match(validatePlan(rp([h('h1', 'next')], []), rctx).join(), /h1: "next" already exists as a horizon \(R003\)/)

// selection: horizon unchecked with a checked epic under it is an error; both unchecked is fine
const rplan = rp([h('h1'), h('h2')], [e('e1', 'h1'), e('e2', 'h2'), e('e3', 'R003')]) as Plan
assert.deepEqual(selectPlan(rplan, ['h1', 'h2', 'e1', 'e2', 'e3']).errors, [])
const rsome = selectPlan(rplan, ['h1', 'e1', 'e3'])
assert.deepEqual(rsome.errors, [])
assert.deepEqual(rsome.plan.kind === 'roadmap' && [...rsome.plan.horizons, ...rsome.plan.epics].map(x => x.key), ['h1', 'e1', 'e3'])
assert.deepEqual(selectPlan(rplan, ['h1', 'e1', 'e2']).errors, ['e2 is under h2, which you unchecked; check h2 or uncheck e2'])
assert.deepEqual(selectPlan(rplan, []).errors, ['nothing selected'])
assert.deepEqual(selectPlan(rplan, ['zz', 'e3']).errors, ['unknown key "zz"'])

// keys are trimmed consistently: an unchecked " t1 " still blocks a dependent "t2"
const padded: Plan = { kind: 'breakdown', epic: 'R002', tasks: [
  { key: ' t1 ', title: 'A', body: 'x' }, { key: 't2', title: 'B', dependsOn: ['t1'], body: 'y' }] }
assert.deepEqual(selectPlan(padded, ['t2']).errors, ['t2 depends on t1, which you unchecked'])

// asRenderablePlan: the chat only draws shapes it can render
assert.equal(asRenderablePlan({ kind: 'breakdown', epic: 'R002' }), null)
assert.equal(asRenderablePlan({ kind: 'roadmap', epics: [{ key: 'e1', title: 'E', body: 'x' }] }), null)
assert.deepEqual(asRenderablePlan({ kind: 'roadmap', epics: [{ key: 'e1', title: 'E', parent: 'R001', body: 'x' }] }),
  { kind: 'roadmap', horizons: [], epics: [{ key: 'e1', title: 'E', parent: 'R001', body: 'x' }] })

// ── breakdown from a spec: newEpic, or no epic ──
const ne = (extra: Record<string, unknown> = {}) => ({ kind: 'breakdown', newEpic: { title: 'Spec import', parent: 'r003', body: 'Outcome.' }, tasks: [t('t1'), t('t2', ['t1'])], ...extra })
assert.deepEqual(validatePlan(ne(), rctx), [])
assert.deepEqual(validatePlan({ kind: 'breakdown', tasks: [t('t1')] }, rctx), [])          // loose tasks
assert.deepEqual(validatePlan({ kind: 'breakdown', epic: '', tasks: [t('t1')] }, rctx), []) // "" = no epic
assert.deepEqual(validatePlan(ne({ epic: 'R004' }), rctx), ['pass either epic (an existing epic) or newEpic, not both'])
assert.deepEqual(validatePlan(ne({ newEpic: { title: 'X', parent: 'R004', body: '' } }), rctx), ['newEpic: parent R004 is an epic, not a horizon (max depth is 2)'])
assert.deepEqual(validatePlan(ne({ newEpic: { title: 'X', parent: 'R9', body: '' } }), rctx), ['newEpic: parent "R9" is not an existing roadmap item'])
assert.deepEqual(validatePlan(ne({ newEpic: { title: 'billing', parent: 'R003', body: '' } }), rctx), ['newEpic: "billing" already exists under R003 (R004)'])
assert.deepEqual(validatePlan(ne({ newEpic: { parent: 'R003' } }), rctx), ['newEpic: title is required', 'newEpic: body must be a markdown string'])
assert.deepEqual(validatePlan(ne({ newEpic: 'x' }), rctx), ['newEpic must be an object { title, parent, body }'])
// selection keeps newEpic
const neSel = selectPlan(ne() as Plan, ['t1'])
assert.deepEqual(neSel.errors, [])
assert.equal(neSel.plan.kind === 'breakdown' && neSel.plan.newEpic?.title, 'Spec import')
// rendering + one-line target
assert.ok(asRenderablePlan(ne()))
assert.ok(asRenderablePlan({ kind: 'breakdown', tasks: [t('t1')] }))
assert.equal(asRenderablePlan({ kind: 'breakdown', newEpic: { title: 'X' }, tasks: [t('t1')] }), null) // parent still streaming
assert.equal(planTarget(ne() as Extract<Plan, { kind: 'breakdown' }>), 'new epic "Spec import"')
assert.equal(planTarget({ kind: 'breakdown', tasks: [] }), 'no epic')
assert.equal(planTarget({ kind: 'breakdown', epic: ' r002 ', tasks: [] }), 'R002')

console.log('plan: ok')
