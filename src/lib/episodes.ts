/**
 * src/lib/episodes.ts
 * Pure session episodes (R050): a deterministic summary + handoff for a session that ended without
 * `vibedoc_update_memory`, built from its activity (groupSessions) and the chat's last reply. No fs.
 * Stored by core.ts as `.vibedoc/episodes/<sessionId>.md`.
 */
import type { ActivityEvent } from './core'
import type { Session } from './sessions'

export type Episode = { sessionId: string; actor: string; start: string; end: string; source: string; headline: string; body: string; file: string }

export interface EpisodeOpts {
  source: string
  lastMessage?: string
  openTasks?: { id: string; title: string; status: string }[]
  /** Agent name for the actor line (`ai:<agent>`); defaults to the session's actor */
  agent?: string
}

/** ≈400 tokens: the body is read at session start (T114) */
export const EPISODE_BODY_CAP = 1600
const MIN_MESSAGE = 200
const LIST_CAPS = [Infinity, 10, 5, 3, 1, 0]

// Events that only read or announce; a turn with nothing else is pure Q&A and leaves no episode.
const READ_ONLY: ActivityEvent['type'][] = ['doc_read', 'session_start']

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…`)

function tail<T>(items: T[], cap: number, fmt: (x: T) => string): string[] {
  if (items.length <= cap) return items.map(fmt)
  return [...items.slice(0, cap).map(fmt), `+${items.length - cap} more`]
}

function renderBody(s: Session, opts: EpisodeOpts, cap: number, msgMax: number): string {
  const happened = [
    ...tail(s.tasks, cap, t => `- ${t.id} → ${t.lastStatus}`),
    ...(s.docs.length ? [`- Docs changed: ${tail(s.docs, cap, d => d).join(', ')}`] : []),
    ...(s.decisions.length ? [`- Decisions: ${tail(s.decisions, cap, d => d).join(', ')}`] : []),
  ].map(l => (l.startsWith('+') ? `- ${l}` : l))
  const msg = (opts.lastMessage ?? '').trim()
  const open = opts.openTasks ?? []
  const parts = [`## What happened\n${happened.join('\n') || `- ${s.headline}`}`]
  if (msg) parts.push(`## Where it stopped\n${clip(msg, msgMax).split('\n').map(l => `> ${l}`).join('\n')}`)
  if (open.length) parts.push(`## Open\n${tail(open, cap, t => `- ${t.id} ${t.title} (${t.status})`).map(l => (l.startsWith('+') ? `- ${l}` : l)).join('\n')}`)
  return parts.join('\n\n')
}

/**
 * Markdown for `.vibedoc/episodes/<id>.md`; '' for a session with no events. Body ≤ EPISODE_BODY_CAP.
 * Only for sessions whose work isn't covered by a handoff (isHandoffWritten false); the headline's "memory updated" reads as entries saved.
 */
export function buildEpisode(s: Session, opts: EpisodeOpts): string {
  if (!s.eventCount) return ''
  const actor = opts.agent ? `ai:${opts.agent}` : s.actor
  const headline = s.headline.replace('memory updated', 'entries saved')
  const head = `# Episode ${s.id}: ${headline}\n**Session:** ${s.id}\n**Actor:** ${actor}\n**Start:** ${s.start}\n**End:** ${s.end}\n**Source:** ${opts.source}\n\n`
  const msgLen = (opts.lastMessage ?? '').trim().length
  let body = ''
  // Trim the last message first, then shorten the lists
  for (const cap of LIST_CAPS) {
    const fixed = renderBody(s, { ...opts, lastMessage: '' }, cap, 0).length
    const room = EPISODE_BODY_CAP - fixed - 30 // heading + quote marks
    body = renderBody(s, opts, cap, Math.max(MIN_MESSAGE, Math.min(msgLen, room)))
    if (body.length <= EPISODE_BODY_CAP) break
  }
  return head + clip(body, EPISODE_BODY_CAP) + '\n'
}

export function parseEpisode(raw: string, file: string): Episode | null {
  const h1 = raw.match(/^# Episode ([^:\n]+): (.*)$/m)
  if (!h1) return null
  const meta = (key: string) => raw.match(new RegExp(`^\\*\\*${key}:\\*\\* (.*)$`, 'm'))?.[1].trim() ?? ''
  const sessionId = meta('Session') || h1[1].trim()
  const start = meta('Start')
  const end = meta('End')
  if (!start || !end) return null
  const bodyAt = raw.search(/^## /m)
  return {
    sessionId, actor: meta('Actor'), start, end, source: meta('Source'),
    headline: h1[2].trim(), body: bodyAt < 0 ? '' : raw.slice(bodyAt).trim(), file,
  }
}

/** Source line for a rewrite of a session's episode: every chat that wrote into the session, in order. */
export function mergeSources(prev: string | undefined, next: string): string {
  const all = (prev ?? '').split(', ').filter(Boolean)
  return all.includes(next) ? all.join(', ') : [...all, next].join(', ')
}

/**
 * The session's last MEMORY.md write covers all its work: no non-read event came after it.
 * Entry saves reuse `memory_updated` ("Entry E001 saved") and count as work, not as a handoff.
 * Work after a handoff (the session is shared by every 'ai' client) still needs an episode.
 */
export function isHandoffWritten(s: Session, events: ActivityEvent[]): boolean {
  const ids = new Set(s.eventIds)
  const mine = events.filter(e => ids.has(e.id) && !READ_ONLY.includes(e.type))
  const isHandoff = (e: ActivityEvent) => e.type === 'memory_updated' && !e.title.startsWith('Entry ')
  const at = mine.filter(isHandoff).reduce<string | null>((m, e) => (m === null || e.timestamp > m ? e.timestamp : m), null)
  return at !== null && !mine.some(e => e.timestamp > at)
}

/** Sessions by `actor` with a non-read event at or after `since` (ISO): the ones a chat turn touched. */
export function turnSessions(sessions: Session[], events: ActivityEvent[], since: string, actor: ActivityEvent['actor'] = 'ai'): Session[] {
  const touched = new Set(events.filter(e => e.timestamp >= since && !READ_ONLY.includes(e.type)).map(e => e.id))
  return sessions.filter(s => s.actor === actor && s.eventIds.some(id => touched.has(id)))
}

/** The session changed something (not only session_start / doc_read): only then is an episode worth writing. */
export function hasWork(s: Session, events: ActivityEvent[]): boolean {
  const ids = new Set(s.eventIds)
  return events.some(e => ids.has(e.id) && !READ_ONLY.includes(e.type))
}

/** "Where it stopped" for a session with no transcript (external agents): the title of its last non-read event. */
export function lastEventTitle(s: Session, events: ActivityEvent[]): string | undefined {
  const ids = new Set(s.eventIds)
  return events
    .filter(e => ids.has(e.id) && !READ_ONLY.includes(e.type))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.title
}

export interface BackfillOpts {
  now: number
  /** Idle gap that ends a session; pass SESSION_GAP_MS (sessions.ts) */
  gapMs: number
  /** Epoch ms of the last MEMORY.md write: sessions that ended before it are covered by that handoff */
  since?: number
  limit?: number
}

/**
 * R050 backfill: ended agent sessions with work, no handoff and no episode file yet, newest first, at most `limit` (5).
 * Ended = idle longer than `gapMs`, or a later session with work by the same actor exists. A later read-only session
 * (another client's vibedoc_read_memory opens one) doesn't end it: the agent may still be working. `sessions` come newest first.
 */
export function sessionsNeedingEpisode(
  sessions: Session[], events: ActivityEvent[], existingIds: Set<string>, currentSessionId: string | null, opts: BackfillOpts,
): Session[] {
  const since = opts.since ?? -Infinity
  return sessions
    .filter(s => {
      if (s.actor !== 'ai' || s.id === currentSessionId || existingIds.has(s.id)) return false
      const end = Date.parse(s.end)
      const ended = opts.now - end > opts.gapMs || sessions.some(o => o.actor === s.actor && o.start > s.start && hasWork(o, events))
      return ended && end > since && hasWork(s, events) && !isHandoffWritten(s, events)
    })
    .slice(0, opts.limit ?? 5)
}
