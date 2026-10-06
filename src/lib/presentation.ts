// Presentation recording (R079): whether a run's video gets Playwright's cursor, highlights, step chapters and a
// hold after each step. On by default; off where speed matters or the API is missing. Part of the test kit
// (FIXTURE_KIT_FILES), so it stays free of value imports. Check: `node src/lib/presentation.check.mts`.
import type { RunPresentation } from './runs-paths.js'

/** `hasScreencast`: the page has `page.screencast.showActions` (Playwright 1.59+; the kit runs the app's own copy). */
export function presentationMode(env: Record<string, string | undefined>, hasScreencast: boolean): RunPresentation {
  const ci = (env.CI ?? '').trim().toLowerCase()
  const reason: RunPresentation['reason'] =
    env.VIBEDOC_BLANK === '1' ? 'blank'
    : env.VIBEDOC_TASK_MAP ? 'suite'
    : env.VIBEDOC_PRESENT === '0' ? 'disabled'
    : ci && ci !== '0' && ci !== 'false' ? 'ci'
    : !hasScreencast ? 'old-playwright'
    : null
  return { on: reason === null, reason }
}
