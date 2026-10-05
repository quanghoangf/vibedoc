/**
 * Honest tests (R063), pure: is a recorded step real proof? A passed step is unverified when it made no assertion,
 * only trivial ones (on literals, not the page), or passed again with the app replaced by a blank page.
 * Unknown is not flagged: runs recorded before the counts existed, or specs not on the kit, have no `assertions`.
 * No fs, no imports. Self-check: node src/lib/honesty.check.mts
 */

export type Assertions = { total: number; onPage: number }

export const UNVERIFIED_REASONS = {
  none: 'no assertion',
  trivial: 'only trivial assertions',
  blank: 'passes without the app',
} as const

/** Why a step doesn't prove its item ([] = it does, or we can't tell). Failed steps prove nothing anyway: []. */
export function stepVerdict(step: { status: string; assertions?: Assertions }, blankPassed = false): string[] {
  if (step.status !== 'passed') return []
  const out: string[] = []
  if (step.assertions) {
    if (step.assertions.total === 0) out.push(UNVERIFIED_REASONS.none)
    else if (step.assertions.onPage === 0) out.push(UNVERIFIED_REASONS.trivial)
  }
  if (blankPassed) out.push(UNVERIFIED_REASONS.blank)
  return out
}

/** Does an `expect(subject)` look at the app (a Locator, Page, APIResponse or `expect.poll`'s function)? */
export function isPageSubject(subject: unknown): boolean {
  if (typeof subject === 'function') return true
  if (!subject || typeof subject !== 'object') return false
  const s = subject as Record<string, unknown>
  return (typeof s.waitFor === 'function' && typeof s.locator === 'function') // Locator
    || typeof s.goto === 'function' // Page
    || (typeof s.status === 'function' && typeof s.headers === 'function') // APIResponse
}
