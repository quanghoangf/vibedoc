// First-week checklist (R084): the VibeDoc loop once, ticked from what is on disk, never by hand.
// Pure (no React, no fs). core.ts gathers the facts (getFirstWeek). Self-check: `node src/lib/first-week.check.mts`.

export const FIRST_WEEK_STEPS = ["agent", "roadmap", "breakdown", "taskDone", "testRun", "memory"] as const
export type FirstWeekStepId = (typeof FIRST_WEEK_STEPS)[number]

export type FirstWeekFacts = Record<FirstWeekStepId, boolean>

export interface FirstWeek {
  steps: { id: FirstWeekStepId; done: boolean }[]
  done: number
  total: number
  /** The first unticked step, null when every step is ticked */
  next: FirstWeekStepId | null
}

export function firstWeek(facts: FirstWeekFacts): FirstWeek {
  const steps = FIRST_WEEK_STEPS.map((id) => ({ id, done: facts[id] === true }))
  const done = steps.filter((s) => s.done).length
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done)?.id ?? null }
}
