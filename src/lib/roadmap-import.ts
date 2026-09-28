/**
 * src/lib/roadmap-import.ts
 * Pure (no fs): draft a roadmap for a project that has none, from ROADMAP.md, from its tasks, or a starter.
 * core.ts `generateRoadmap()` assigns ids and writes the files.
 */

import type { RoadmapStatus, Task } from './core'

export interface RoadmapDraft {
  key: string
  title: string
  parent: string | null // key of the parent draft; null = horizon
  status: RoadmapStatus
  tasks: string[]
  body: string
}

export type RoadmapSource = 'roadmap-md' | 'tasks' | 'starter'

const SHIPPED = /\b(shipped|done|released|complete[d]?)\b/i
const MAX_TITLE = 80

function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(s: string): string {
  return s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE - 1).trimEnd()}…` : s
}

function rollUp(statuses: RoadmapStatus[]): RoadmapStatus {
  if (statuses.length && statuses.every(s => s === 'done')) return 'done'
  if (statuses.some(s => s !== 'planned')) return 'in-progress'
  return 'planned'
}

/** `## Section` with top-level bullets → horizon + features. Sections without bullets are skipped. */
export function roadmapFromMarkdown(md: string): RoadmapDraft[] {
  const out: RoadmapDraft[] = []
  let horizon: RoadmapDraft | null = null
  let intro: string[] = []
  let feature: RoadmapDraft | null = null
  let kids = 0

  const closeHorizon = () => {
    if (horizon && kids > 0) {
      horizon.body = intro.join(' ').trim()
      const own = out.filter(d => d.parent === horizon?.key).map(d => d.status)
      if (horizon.status !== 'done') horizon.status = rollUp(own)
    } else if (horizon) {
      // no bullets: drop the heading
      out.splice(out.indexOf(horizon), 1)
    }
    horizon = null
    feature = null
    intro = []
    kids = 0
  }

  for (const line of md.split('\n')) {
    const h2 = line.match(/^##\s+(.+?)\s*#*\s*$/)
    if (h2) {
      closeHorizon()
      const title = clip(plain(h2[1]))
      horizon = { key: `h${out.length}`, title, parent: null, status: SHIPPED.test(title) ? 'done' : 'planned', tasks: [], body: '' }
      out.push(horizon)
      continue
    }
    if (!horizon) continue
    if (/^#/.test(line)) { closeHorizon(); continue } // H1 / H3+ ends the section

    const bullet = line.match(/^[-*]\s+(?:\[([ xX])\]\s+)?(.*)$/)
    if (bullet) {
      const text = bullet[2]
      const named = text.match(/^\*\*(.+?)\*\*\s*(?:[—–:-]\s*)?(.*)$/)
      const title = clip(plain(named ? named[1] : text))
      if (!title) continue
      const status: RoadmapStatus = bullet[1]
        ? (bullet[1].toLowerCase() === 'x' ? 'done' : 'planned')
        : horizon.status === 'done' ? 'done' : 'planned'
      feature = { key: `f${out.length}`, title, parent: horizon.key, status, tasks: [], body: named ? named[2].trim() : '' }
      out.push(feature)
      kids++
      continue
    }

    const cont = line.match(/^\s+(\S.*)$/)
    if (feature && cont) {
      feature.body = [feature.body, cont[1].replace(/^[-*]\s+/, '- ')].filter(Boolean).join('\n')
    } else if (!feature && line.trim() && !/^-{3,}$/.test(line.trim())) {
      intro.push(line.trim())
    }
  }
  closeHorizon()
  return out
}

const phaseRank = (p: string) => {
  const n = parseFloat(p)
  return Number.isFinite(n) ? n : Infinity
}

/** One horizon per task phase, one feature per (non-cancelled) task. */
export function roadmapFromTasks(tasks: Pick<Task, 'id' | 'title' | 'status' | 'phase'>[]): RoadmapDraft[] {
  const groups = new Map<string, typeof tasks>()
  for (const t of tasks) {
    if (t.status === 'cancelled') continue
    const phase = plain(t.phase || '').replace(/^—$/, '') || 'Unphased'
    groups.set(phase, [...(groups.get(phase) ?? []), t])
  }
  const phases = [...groups.keys()].sort((a, b) => phaseRank(a) - phaseRank(b) || a.localeCompare(b))

  const out: RoadmapDraft[] = []
  for (const phase of phases) {
    const key = `h${out.length}`
    const features = (groups.get(phase) ?? []).map((t): RoadmapDraft => ({
      key: `f${t.id}`,
      title: clip(t.title),
      parent: key,
      status: t.status === 'done' ? 'done' : t.status === 'in-progress' ? 'in-progress' : 'planned',
      tasks: [t.id],
      body: '',
    }))
    out.push({ key, title: clip(phase), parent: null, status: rollUp(features.map(f => f.status)), tasks: [], body: '' }, ...features)
  }
  return out
}

export function starterRoadmap(): RoadmapDraft[] {
  const h = (key: string, title: string, status: RoadmapStatus, body: string): RoadmapDraft =>
    ({ key, title, parent: null, status, tasks: [], body })
  return [
    h('shipped', 'Shipped', 'done', 'What is already live.'),
    h('now', 'Now', 'planned', 'What we are building right now.'),
    h('next', 'Next', 'planned', 'Planned once the current work ships.'),
    h('later', 'Later', 'planned', 'Ideas — not committed.'),
  ]
}
