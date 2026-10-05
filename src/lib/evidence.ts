/**
 * A task's evidence doc (R060), pure: every checklist item with what the newest (or a picked) run proved, its
 * screenshot and error, the run's time / commit / video, and the history of kept runs. One formatter for both
 * the fixture's `EVIDENCE.md` (relative links) and VibeDoc's view (API links), so they never drift.
 * No fs, no React. Self-check: node src/lib/evidence.check.mts
 */

import type { ManualTestItem } from './manual-tests.js'
import type { RunManifest, RunStep, RunTest } from './runs-paths.js'

/** A `failed` ReviewMark (src/lib/review.ts), spelled out here: the test kit ships this file without review.ts. */
type FailedMark = { item: number; step: string; kind: 'failed'; comment?: string; screenshot?: string }

export type ItemResult = 'passed' | 'failed' | 'missing' | 'manual'
/** `unverified` (R063): why the step doesn't prove the item, from the injected verdict; [] = it does / unknown. */
export interface EvidenceRow { item: ManualTestItem; result: ItemResult; step: RunStep | null; unverified: string[] }
/** R063: a step's honesty verdict (stepVerdict in honesty.ts), injected so this lib imports no values. */
export type StepVerdict = (step: RunStep, run: RunManifest) => string[]

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')

/**
 * 🤖 items take the status of the run step with the same text (`/work-epic` copies the item text into `step()`),
 * else `missing`; manual items are `manual`. Steps no item claimed come back as `extra`.
 */
export function matchItems(items: ManualTestItem[], run: RunManifest | null, verdict?: StepVerdict): { rows: EvidenceRow[]; extra: RunStep[] } {
  const left = [...(run?.steps ?? [])]
  const rows = items.map((item): EvidenceRow => {
    if (!item.auto) return { item, result: 'manual', step: null, unverified: [] }
    const at = left.findIndex(s => norm(s.name) === norm(item.text))
    if (at < 0) return { item, result: 'missing', step: null, unverified: [] }
    const [step] = left.splice(at, 1)
    return { item, result: step.status, step, unverified: (run && verdict?.(step, run)) || [] }
  })
  return { rows, extra: left }
}

export interface EvidenceInput {
  taskId: string
  title: string
  items: ManualTestItem[]
  spec: string | null
  /** Newest first */
  runs: RunManifest[]
  /** The run detailed at the top; default the newest */
  runId?: string | null
  /** A run's media file → link; default `<runId>/<file>` (relative to the task's runs folder) */
  src?: (runId: string, file: string) => string
  /** R063: flags steps that don't prove their item (none = nothing flagged) */
  verdict?: StepVerdict
}

const GLYPH: Record<RunStep['status'], string> = { passed: '✅', failed: '❌' }

/**
 * R065: the flaky test a step belongs to, when that step is where its first attempt failed (`firstFailure.step`),
 * else null. A flaky test without a named step marks nothing.
 */
export function flakyFor(run: RunManifest | null, stepName: string): (RunTest & { firstFailure: NonNullable<RunTest['firstFailure']> }) | null {
  const t = run?.tests?.find(x => x.outcome === 'flaky' && x.firstFailure && x.firstFailure.step && norm(x.firstFailure.step) === norm(stepName))
  return t ? (t as RunTest & { firstFailure: NonNullable<RunTest['firstFailure']> }) : null
}

/** Markdown lines under a flaky step: what its first attempt showed. */
function flakyBlock(f: ReturnType<typeof flakyFor>, runId: string, src: (runId: string, file: string) => string): string[] {
  if (!f) return []
  const out = [`  🔁 flaky (passed on attempt ${f.attempts}); the first attempt failed:`]
  if (f.firstFailure.error) out.push('  ```', ...f.firstFailure.error.replace(/\x1b\[[0-9;]*m/g, '').trimEnd().split('\n').slice(0, 6).map(l => `  ${l.replace(/```/g, "'''")}`), '  ```')
  if (f.firstFailure.screenshot) out.push(`  ![first attempt](${src(runId, f.firstFailure.screenshot)})`)
  return out
}
const alt = (s: string) => s.replace(/[[\]*`_]/g, '').trim()
const cell = (s: string) => s.replace(/\|/g, '\\|')

/** `2026-10-04T07:43:14.120Z` → `2026-10-04 07:43:14 UTC` */
function when(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]} UTC` : iso
}

function duration(run: RunManifest): string | null {
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  if (!Number.isFinite(ms) || ms < 0) return null
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const short = (commit: string | null) => (commit ? commit.slice(0, 7) : null)

function stepBlock(step: RunStep, runId: string, src: (runId: string, file: string) => string, label: string, unverified: string[] = []): string[] {
  const out: string[] = []
  if (step.error) out.push('  ```', ...step.error.replace(/\x1b\[[0-9;]*m/g, '').trimEnd().split('\n').map(l => `  ${l.replace(/```/g, "'''")}`), '  ```')
  if (step.screenshot) out.push(`  ![${alt(label)}](${src(runId, step.screenshot)})`)
  if (unverified.length) out.push(`  ⚠️ unverified: ${unverified.join(', ')}`)
  return out
}

export function formatEvidence({ taskId, title, items, spec, runs, runId, src = (r, f) => `${r}/${f}`, verdict }: EvidenceInput): string {
  const run = (runId ? runs.find(r => r.runId === runId) : runs[0]) ?? null
  const out = [`# ${taskId} — ${title}: evidence`, '']

  if (run) {
    const passed = run.steps.filter(s => s.status === 'passed').length
    const unverified = verdict ? run.steps.filter(s => verdict(s, run).length).length : 0
    const bits = [
      `**${GLYPH[run.status]} ${run.status}**`,
      `${passed}/${run.steps.length} steps`,
      unverified && `${unverified} unverified`,
      run.flaky ? `${run.flaky} flaky` : null,
      when(run.startedAt),
      duration(run),
      short(run.commit) && `commit \`${short(run.commit)}\``,
      spec && `spec \`${spec}\``,
    ].filter(Boolean)
    out.push(bits.join(' · '))
    if (run.video) out.push('', `[▶ Video of this run](${src(run.runId, run.video)})`)
  } else {
    out.push(`_No run yet.${spec ? ` Run \`${spec}\` to record evidence.` : ''}_`)
  }

  const { rows, extra } = matchItems(items, run, verdict)
  const groups: [string, EvidenceRow[]][] = [
    ['Steps', rows.filter(r => r.item.group === 'steps')],
    ['Regression risk', rows.filter(r => r.item.group === 'regression')],
  ]
  if (rows.length) out.push('', '## Checklist')
  for (const [name, list] of groups) {
    if (!list.length) continue
    out.push('', `### ${name}`)
    for (const r of list) {
      if (r.result === 'manual') out.push(`- ${r.item.checked ? '☑' : '☐'} ${r.item.text} — _manual, ${r.item.checked ? 'ticked' : 'not ticked yet'}_`)
      else if (r.result === 'missing') out.push(`- ⚠️ ${r.item.text} — _${run ? 'no step in this run' : 'no run yet'}_`)
      else out.push(`- ${GLYPH[r.result]} ${r.item.text}`, ...stepBlock(r.step!, run!.runId, src, r.item.text, r.unverified), ...flakyBlock(flakyFor(run, r.step!.name), run!.runId, src))
    }
  }
  if (run && extra.length) {
    out.push('', rows.length ? '### Steps not in the checklist' : '## Steps')
    for (const s of extra) out.push(`- ${GLYPH[s.status]} ${s.name}`, ...stepBlock(s, run.runId, src, s.name, verdict?.(s, run) ?? []), ...flakyBlock(flakyFor(run, s.name), run.runId, src))
  }

  if (runs.length) {
    out.push('', '## History', '', '| Run | Result | Steps | Commit | Video |', '|---|---|---|---|---|')
    for (const r of runs) {
      const passed = r.steps.filter(s => s.status === 'passed').length
      out.push(`| ${cell(when(r.startedAt))}${r === run ? ' · **shown**' : ''} | ${GLYPH[r.status]} ${r.status} | ${passed}/${r.steps.length} | ${short(r.commit) ? `\`${short(r.commit)}\`` : '—'} | ${r.video ? `[▶](${src(r.runId, r.video)})` : '—'} |`)
    }
  }
  return out.join('\n') + '\n'
}

/**
 * R061: what a finished Run writes back into the checklist. 🤖 items whose step passed get ticked, 🤖 items whose
 * step failed get unticked (the run disproved them); manual items and 🤖 items with no step are left alone.
 * R063: a passed step that is unverified (`unverified` reasons) proves nothing either: its item is unticked.
 */
export function ticksForRun(items: ManualTestItem[], steps: { name: string; status: string; unverified?: string[] }[]): { tick: number[]; untick: number[] } {
  const left = [...steps]
  const tick: number[] = []
  const untick: number[] = []
  for (const item of items) {
    if (!item.auto) continue
    const at = left.findIndex(s => norm(s.name) === norm(item.text))
    if (at < 0) continue
    const [step] = left.splice(at, 1)
    const proves = step.status === 'passed' && !step.unverified?.length
    if (proves && !item.checked) tick.push(item.index)
    if (!proves && item.checked) untick.push(item.index)
  }
  return { tick, untick }
}

/**
 * R065: what a failed Run sends back: one `failed` mark per 🤖 item whose step failed (first error line, its
 * screenshot), plus failed steps no item names (`item: -1`), plus the failed test itself when no step failed
 * (a crash outside the steps). A passed or flaky run gives none.
 */
export function failedMarksForRun(items: ManualTestItem[], run: RunManifest | null): FailedMark[] {
  if (!run || run.status !== 'failed') return []
  const first = (e: string | null) => e?.replace(/\x1b\[[0-9;]*m/g, '').split('\n').find(l => l.trim())?.trim()
  const mark = (item: number, step: RunStep): FailedMark => ({
    item, step: step.name, kind: 'failed', ...(first(step.error) ? { comment: first(step.error) } : {}), ...(step.screenshot ? { screenshot: step.screenshot } : {}),
  })
  const { rows, extra } = matchItems(items, run)
  const marks = [
    ...rows.filter(r => r.result === 'failed' && r.step).map(r => mark(r.item.index, r.step!)),
    ...extra.filter(s => s.status === 'failed').map(s => mark(-1, s)),
  ]
  if (!marks.length) marks.push({ item: -1, step: run.tests?.[0]?.title ?? 'The test', kind: 'failed', comment: 'failed outside its steps' })
  return marks
}
