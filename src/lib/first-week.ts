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

/** Where a step happens: a page to open and/or the exact command to copy. */
export interface StepAction {
  href?: string
  command?: string
}

export interface StepContext {
  /** This server's origin, e.g. http://localhost:3084 (the MCP URL is `${origin}/api/mcp`) */
  origin: string
  epicToBreakDown: string | null
  epicToWork: string | null
}

/**
 * The one action for each step. `agent` points at Settings and the `claude mcp add` line (the header's Connect menu);
 * seam: R081 (Connect panel) and R080 (stable address) replace both when they land.
 */
export function stepAction(id: FirstWeekStepId, ctx: StepContext): StepAction {
  switch (id) {
    case "agent": return { href: "/settings", command: `claude mcp add --transport http vibedoc ${ctx.origin}/api/mcp` }
    case "roadmap": return { href: "/roadmap", command: "/vibedoc:roadmap" }
    case "breakdown": return { command: ctx.epicToBreakDown ? `/vibedoc:breakdown ${ctx.epicToBreakDown}` : "/vibedoc:breakdown" }
    case "taskDone": return { command: ctx.epicToWork ? `/vibedoc:work ${ctx.epicToWork}` : "/vibedoc:work" }
    case "testRun": return { href: "/manual-tests" }
    case "memory": return { href: "/memory" }
  }
}
