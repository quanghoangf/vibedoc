/**
 * A task's evidence doc (R060), pure: every checklist item with what the newest (or a picked) run proved, its
 * screenshot and error, the run's time / commit / video, and the history of kept runs. One formatter for both
 * the fixture's `EVIDENCE.md` (relative links) and VibeDoc's view (API links), so they never drift.
 * No fs, no React. Self-check: node src/lib/evidence.check.mts
 */

import type { ManualTestItem } from './manual-tests.js'
import type { RunManifest, RunStep } from './runs-paths.js'

export type ItemResult = 'passed' | 'failed' | 'missing' | 'manual'
export interface EvidenceRow { item: ManualTestItem; result: ItemResult; step: RunStep | null }

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')

/**
 * 🤖 items take the status of the run step with the same text (`/work-epic` copies the item text into `step()`),
 * else `missing`; manual items are `manual`. Steps no item claimed come back as `extra`.
 */
export function matchItems(items: ManualTestItem[], run: RunManifest | null): { rows: EvidenceRow[]; extra: RunStep[] } {
  const left = [...(run?.steps ?? [])]
  const rows = items.map((item): EvidenceRow => {
    if (!item.auto) return { item, result: 'manual', step: null }
    const at = left.findIndex(s => norm(s.name) === norm(item.text))
    if (at < 0) return { item, result: 'missing', step: null }
    const [step] = left.splice(at, 1)
    return { item, result: step.status, step }
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
}

const GLYPH: Record<RunStep['status'], string> = { passed: '✅', failed: '❌' }
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

function stepBlock(step: RunStep, runId: string, src: (runId: string, file: string) => string, label: string): string[] {
  const out: string[] = []
  if (step.error) out.push('  ```', ...step.error.replace(/\x1b\[[0-9;]*m/g, '').trimEnd().split('\n').map(l => `  ${l.replace(/```/g, "'''")}`), '  ```')
  if (step.screenshot) out.push(`  ![${alt(label)}](${src(runId, step.screenshot)})`)
  return out
}

export function formatEvidence({ taskId, title, items, spec, runs, runId, src = (r, f) => `${r}/${f}` }: EvidenceInput): string {
  const run = (runId ? runs.find(r => r.runId === runId) : runs[0]) ?? null
  const out = [`# ${taskId} — ${title}: evidence`, '']

  if (run) {
    const passed = run.steps.filter(s => s.status === 'passed').length
    const bits = [
      `**${GLYPH[run.status]} ${run.status}**`,
      `${passed}/${run.steps.length} steps`,
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

  const { rows, extra } = matchItems(items, run)
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
      else out.push(`- ${GLYPH[r.result]} ${r.item.text}`, ...stepBlock(r.step!, run!.runId, src, r.item.text))
    }
  }
  if (run && extra.length) {
    out.push('', rows.length ? '### Steps not in the checklist' : '## Steps')
    for (const s of extra) out.push(`- ${GLYPH[s.status]} ${s.name}`, ...stepBlock(s, run.runId, src, s.name))
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
