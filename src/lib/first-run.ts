// First-run feedback (R086): anonymous first-run step events, only with consent. Pure: no fs, no React,
// no value imports from other libs (checked with `node src/lib/first-run.check.mts`).
// The state lives in the project's .vibedoc/feedback.json (core readFeedback / saveFeedback).

// Copied from site/src/data/links.ts (the app can't import from site/): keep them in sync.
export const GOATCOUNTER = 'vibedoc'
export const GITHUB = 'https://github.com/quanghoangf/vibedoc'

/** The steps in funnel order. The ids are the wire format (`/first-run/<id>`): never rename one. */
export const STEPS = ['started', 'agent-connected', 'first-roadmap', 'first-task-done'] as const
export type StepId = (typeof STEPS)[number]

export interface FeedbackState {
  /** null = never asked */
  consent: boolean | null
  answeredAt?: string
  /** Steps that are done with: sent, or already reached when the user opted in */
  sent: StepId[]
}

export const EMPTY_FEEDBACK: FeedbackState = { consent: null, sent: [] }

/** Reads a parsed feedback.json leniently: anything unknown falls back to "never asked". */
export function parseFeedback(raw: unknown): FeedbackState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_FEEDBACK }
  const r = raw as Record<string, unknown>
  const consent = typeof r.consent === 'boolean' ? r.consent : null
  const sent = Array.isArray(r.sent) ? STEPS.filter((s) => (r.sent as unknown[]).includes(s)) : []
  return { consent, sent, ...(typeof r.answeredAt === 'string' ? { answeredAt: r.answeredAt } : {}) }
}

/** What the project shows today, from data VibeDoc already has. `started` is reached by opening VibeDoc at all. */
export function reachedSteps(p: {
  tasks: { status: string }[]
  roadmap: { parent: string | null }[]
  activity: { type: string; actor: string }[]
}): StepId[] {
  const out: StepId[] = ['started']
  if (p.activity.some((e) => e.type === 'session_start' && e.actor === 'ai')) out.push('agent-connected')
  if (p.roadmap.some((r) => r.parent)) out.push('first-roadmap')
  if (p.tasks.some((t) => t.status === 'done')) out.push('first-task-done')
  return out
}

// ponytail: GoatCounter folds visits per IP and day, so two first runs from one IP on one day may count once.
// Fine for a funnel; a per-run id would need its own collector.
/** The one request a step makes: an event hit on the site's GoatCounter, carrying only the step id. */
export function stepUrl(step: StepId): string {
  return `https://${GOATCOUNTER}.goatcounter.com/count?p=${encodeURIComponent(`/first-run/${step}`)}&t=${encodeURIComponent(`First run: ${step}`)}&e=true`
}

/** Reached, not yet sent, in funnel order; nothing without consent. */
export function pendingSteps(state: FeedbackState, reached: StepId[]): StepId[] {
  if (state.consent !== true) return []
  return STEPS.filter((s) => reached.includes(s) && !state.sent.includes(s))
}

/**
 * The state after the user answers (on the card or in Settings). Opting in marks the steps already reached as
 * done with, except `started`, so a project that is long set up doesn't send a whole funnel at once.
 */
export function applyConsent(state: FeedbackState, consent: boolean, reached: StepId[], now: string): FeedbackState {
  const sent = consent && state.consent !== true
    ? STEPS.filter((s) => state.sent.includes(s) || (s !== 'started' && reached.includes(s)))
    : state.sent
  return { consent, answeredAt: now, sent }
}

/** Marks a step sent (idempotent). */
export function markSent(state: FeedbackState, step: StepId): FeedbackState {
  return state.sent.includes(step) ? state : { ...state, sent: STEPS.filter((s) => s === step || state.sent.includes(s)) }
}

export function isStep(s: unknown): s is StepId {
  return typeof s === 'string' && (STEPS as readonly string[]).includes(s)
}

/** The furthest step reached (funnel order), what the "Stuck? Tell us" issue reports. */
export function lastStep(reached: StepId[]): StepId {
  return [...STEPS].reverse().find((s) => reached.includes(s)) ?? 'started'
}

/**
 * "Stuck? Tell us": a new GitHub issue prefilled with only the VibeDoc version, the OS name and the last step.
 * The user reads and submits it themselves; nothing from the project goes in.
 */
export function issueUrl(p: { version: string; os: string; lastStep: StepId }): string {
  const body = [
    '**What were you trying to do?**',
    '',
    '',
    '**What happened instead?**',
    '',
    '',
    '---',
    `VibeDoc ${p.version} · ${p.os || 'unknown OS'} · last first-run step: ${p.lastStep}`,
  ].join('\n')
  const q = new URLSearchParams({ title: 'Stuck during setup: ', body, labels: 'first-run' })
  return `${GITHUB}/issues/new?${q}`
}
