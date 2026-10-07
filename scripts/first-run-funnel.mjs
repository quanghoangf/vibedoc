#!/usr/bin/env node
// The first-run funnel (R086) from GoatCounter: how many opted-in first runs reached each step.
//   GOATCOUNTER_TOKEN=<API token with "Read statistics"> node scripts/first-run-funnel.mjs [--days 30]
//   node scripts/first-run-funnel.mjs --check   (self-check, no network)
// Steps and site code mirror src/lib/first-run.ts (STEPS, GOATCOUNTER); keep them in sync.
import assert from 'node:assert/strict'

const SITE = 'vibedoc'
const STEPS = ['started', 'agent-connected', 'first-roadmap', 'first-task-done']

/** Counts per step from GoatCounter's hits, which may store an event path with or without its leading "/". */
export function stepCounts(hits) {
  const counts = Object.fromEntries(STEPS.map((s) => [s, 0]))
  for (const h of hits) {
    const step = String(h.path ?? '').replace(/^\//, '').replace(/^first-run\//, '')
    if (step in counts) counts[step] += h.count ?? 0
  }
  return counts
}

/** The funnel as a text table: count, share of `started`, and the drop from the step before. */
export function formatFunnel(counts, days) {
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')
  const rows = STEPS.map((s, i) => {
    const n = counts[s] ?? 0
    const prev = i ? counts[STEPS[i - 1]] ?? 0 : null
    return [s, String(n), pct(n, counts.started), prev == null ? '' : prev ? `-${pct(prev - n, prev)}` : '—']
  })
  const head = ['step', 'runs', 'of started', 'drop']
  const w = head.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c].length)))
  const line = (r) => r.map((v, c) => (c === 0 ? v.padEnd(w[c]) : v.padStart(w[c]))).join('  ')
  return [`First-run funnel, last ${days} days (opted-in runs only)`, line(head), ...rows.map(line)].join('\n')
}

if (process.argv.includes('--check')) {
  const counts = stepCounts([
    { path: '/first-run/started', count: 40 },
    { path: 'first-run/agent-connected', count: 20 },
    { path: '/first-run/first-roadmap', count: 10 },
    { path: '/first-run/first-task-done', count: 5 },
    { path: '/', count: 999 },
  ])
  assert.deepEqual(counts, { started: 40, 'agent-connected': 20, 'first-roadmap': 10, 'first-task-done': 5 })
  const out = formatFunnel(counts, 30)
  assert.match(out, /agent-connected\s+20\s+50%\s+-50%/)
  assert.match(out, /first-task-done\s+5\s+13%\s+-50%/)
  assert.match(formatFunnel(stepCounts([]), 7), /started\s+0\s+—/)
  console.log(out)
  console.log('first-run-funnel: ok')
} else {
  const token = process.env.GOATCOUNTER_TOKEN
  if (!token) {
    console.error(`Set GOATCOUNTER_TOKEN: an API token from https://${SITE}.goatcounter.com/user/api with "Read statistics".`)
    process.exit(1)
  }
  const i = process.argv.indexOf('--days')
  const days = i > 0 ? Number(process.argv[i + 1]) || 30 : 30
  const end = new Date()
  end.setUTCMinutes(0, 0, 0)
  const start = new Date(end.getTime() - days * 864e5)
  const q = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), limit: '100', path_by_name: 'true' })
  for (const s of STEPS) for (const p of [`/first-run/${s}`, `first-run/${s}`]) q.append('include_paths', p)
  const res = await fetch(`https://${SITE}.goatcounter.com/api/v0/stats/hits?${q}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error(`GoatCounter answered ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  const { hits = [] } = await res.json()
  console.log(formatFunnel(stepCounts(hits), days))
}
