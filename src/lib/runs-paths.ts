/**
 * Where test-run artifacts live (R059): `<runsRoot>/<project>/<taskId>/<runId>/`, outside every repo.
 * Pure (path + os only, no fs), shared by the Playwright fixture (`src/testing/playwright-fixture.ts`) and core.
 * Self-check: node src/lib/runs-paths.check.mts
 */

import os from 'os'
import path from 'path'

const SLUG_MAX = 60

/** `$VIBEDOC_RUNS_DIR`, else `~/.vibedoc/runs`. */
export function runsRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.VIBEDOC_RUNS_DIR || path.join(os.homedir(), '.vibedoc', 'runs')
}

/** Lowercase, non-alphanumerics → `-`, at most 60 chars, no leading/trailing `-`. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, SLUG_MAX).replace(/-+$/, '')
}

/** Project folder name: the slugged basename of the project root (`/work/My App` → `my-app`). */
export function projectKey(root: string): string {
  return slug(path.basename(path.resolve(root))) || 'project'
}

export function runDir(project: string, taskId: string, runId: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(runsRoot(env), project, taskId, runId)
}

/** Compact UTC timestamp, sorts lexically: 2026-10-04T10:15:00.123Z → `20261004T101500Z`. */
export function newRunId(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

/** Screenshot name for a step: `01-open-board-board-loads.png`. */
export function stepFile(index: number, name: string): string {
  return `${String(index).padStart(2, '0')}-${slug(name) || 'step'}.png`
}
