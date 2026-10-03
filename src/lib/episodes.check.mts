// Self-check for episodes. Run: node src/lib/episodes.check.mts
import assert from 'node:assert/strict'
import type { ActivityEvent } from './core'
import { groupSessions } from './sessions.ts'
import { SESSION_GAP_MS } from './sessions.ts'
import { EPISODE_BODY_CAP, buildEpisode, isHandoffWritten, lastEventTitle, mergeSources, parseEpisode, sessionsNeedingEpisode, turnSessions } from './episodes.ts'

let n = 0
const at = (min: number) => new Date(Date.UTC(2026, 9, 3, 9, 0) + min * 60_000).toISOString()
const ev = (min: number, type: ActivityEvent['type'], extra: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({ id: `e${++n}`, timestamp: at(min), type, actor: 'ai', title: type, sessionId: 'ses_1', ...extra })

const events = [
  ev(0, 'session_start'),
  ev(1, 'task_updated', { taskId: 'T046', taskStatus: 'done' }),
  ev(2, 'task_updated', { taskId: 'T047', taskStatus: 'in-progress' }),
  ev(3, 'doc_created', { detail: 'docs/x.md' }),
  ev(4, 'decision_logged', { title: 'ADR-012 Use files' }),
]
const [s] = groupSessions(events)
const opts = { source: 'chat c-abc123', agent: 'claude-code', lastMessage: 'Moved T047.\nNext: finish it.', openTasks: [{ id: 'T047', title: 'Write it', status: 'in-progress' }] }

// Build → parse round trip
const md = buildEpisode(s, opts)
assert.match(md, /^# Episode ses_1: 2 tasks moved \(1 done\) · 1 doc changed · 1 ADR\n\*\*Session:\*\* ses_1\n\*\*Actor:\*\* ai:claude-code\n/)
assert.match(md, /- T046 → done\n- T047 → in-progress\n- Docs changed: docs\/x\.md\n- Decisions: ADR-012 Use files/)
assert.match(md, /## Where it stopped\n> Moved T047\.\n> Next: finish it\./)
assert.match(md, /## Open\n- T047 Write it \(in-progress\)/)
const ep = parseEpisode(md, '.vibedoc/episodes/ses_1.md')
assert.ok(ep)
assert.equal(ep.sessionId, 'ses_1')
assert.equal(ep.actor, 'ai:claude-code')
assert.equal(ep.start, at(0))
assert.equal(ep.end, at(4))
assert.equal(ep.source, 'chat c-abc123')
assert.equal(ep.headline, s.headline)
assert.ok(ep.body.startsWith('## What happened'))
assert.equal(ep.file, '.vibedoc/episodes/ses_1.md')
assert.equal(parseEpisode('# Not an episode', 'x.md'), null)
// Same input → same file (writing is idempotent)
assert.equal(buildEpisode(s, opts), md)

// Handoff detection: a MEMORY.md write counts, an entry save doesn't
assert.equal(isHandoffWritten(s, events), false)
const entry = [...events, ev(5, 'memory_updated', { title: 'Entry E001 saved' })]
const [se] = groupSessions(entry)
assert.equal(se.memoryUpdated, true)
assert.equal(isHandoffWritten(se, entry), false)
// …and its episode headline doesn't claim a memory update
const seMd = buildEpisode(se, opts)
assert.match(seMd, /^# Episode ses_1: .* · entries saved\n/)
assert.doesNotMatch(seMd, /memory updated/)
const handoff = [...entry, ev(6, 'memory_updated', { title: 'Session memory updated' })]
assert.equal(isHandoffWritten(groupSessions(handoff)[0], handoff), true)
// …but only one inside this session
const other = [...events, ev(6, 'memory_updated', { title: 'Session memory updated', sessionId: 'ses_2' })]
assert.equal(isHandoffWritten(groupSessions(other).find(x => x.id === 'ses_1')!, other), false)

// Size cap: long transcript and long lists still fit
const many = Array.from({ length: 80 }, (_, i) => ev(10 + i, 'task_updated', { taskId: `T${200 + i}`, taskStatus: 'in-progress', sessionId: 'ses_big' }))
const [big] = groupSessions(many)
const huge = buildEpisode(big, { source: 'chat c-x', lastMessage: 'word '.repeat(2000), openTasks: big.tasks.map(t => ({ id: t.id, title: 'A long task title here', status: t.lastStatus })) })
const hugeEp = parseEpisode(huge, 'f')
assert.ok(hugeEp)
assert.ok(hugeEp.body.length <= EPISODE_BODY_CAP, `body ${hugeEp.body.length}`)
assert.match(hugeEp.body, /\+\d+ more/)
assert.match(hugeEp.body, /## Where it stopped\n> word/)
// The message is trimmed before the lists: a short session keeps every task
const longMsg = buildEpisode(s, { ...opts, lastMessage: 'x'.repeat(5000) })
assert.ok(parseEpisode(longMsg, 'f')!.body.length <= EPISODE_BODY_CAP)
assert.match(longMsg, /- T047 → in-progress/)
assert.doesNotMatch(longMsg, /more/)

// Empty session writes nothing
assert.equal(buildEpisode({ ...s, eventCount: 0, eventIds: [], tasks: [], docs: [], decisions: [] }, opts), '')

// Turn window: sessions with a non-read event since the turn began; read-only turns and humans don't count
const human = ev(20, 'task_updated', { actor: 'human', taskId: 'T1', taskStatus: 'done', sessionId: 'ses_h' })
const reads = [ev(20, 'session_start', { sessionId: 'ses_r' }), ev(21, 'doc_read', { sessionId: 'ses_r' })]
const all = [...events, human, ...reads]
const ss = groupSessions(all)
assert.deepEqual(turnSessions(ss, all, at(1)).map(x => x.id), ['ses_1'])
assert.deepEqual(turnSessions(ss, all, at(10)).map(x => x.id), [])

// Source: a session shared by two chats lists both; a later turn of the same chat changes nothing
assert.equal(mergeSources(undefined, 'chat c-1'), 'chat c-1')
assert.equal(mergeSources('chat c-1', 'chat c-2'), 'chat c-1, chat c-2')
assert.equal(mergeSources('chat c-1, chat c-2', 'chat c-2'), 'chat c-1, chat c-2')
assert.equal(mergeSources('chat c-1, chat c-2', 'chat c-1'), 'chat c-1, chat c-2')

// Backfill: which ended sessions get an `inferred` episode
const bf = [
  ev(0, 'task_updated', { taskId: 'T1', taskStatus: 'done', title: 'T1 → done', sessionId: 'old' }), // ended: idle > 30 min
  ev(5, 'task_updated', { taskId: 'T2', taskStatus: 'done', sessionId: 'handoff' }),
  ev(6, 'memory_updated', { title: 'Session memory updated', sessionId: 'handoff' }),
  ev(7, 'task_updated', { taskId: 'T3', taskStatus: 'done', sessionId: 'has_ep' }),
  ev(8, 'session_start', { sessionId: 'reads' }),
  ev(9, 'doc_read', { sessionId: 'reads' }),
  ev(10, 'task_updated', { actor: 'human', taskId: 'T4', taskStatus: 'done', sessionId: 'human' }),
  ev(50, 'task_updated', { taskId: 'T5', taskStatus: 'in-progress', sessionId: 'superseded' }), // recent, but a later session exists
  ev(52, 'task_updated', { taskId: 'T6', taskStatus: 'in-progress', sessionId: 'cur' }), // the caller's, still running
]
const bss = groupSessions(bf)
const pick = (o: Partial<Parameters<typeof sessionsNeedingEpisode>[4]> = {}, cur: string | null = 'cur', existing = ['has_ep']) =>
  sessionsNeedingEpisode(bss, bf, new Set(existing), cur, { now: Date.parse(at(55)), gapMs: SESSION_GAP_MS, ...o }).map(x => x.id)
assert.deepEqual(pick(), ['superseded', 'old']) // newest first; handoff, existing episode, read-only and human skipped
assert.deepEqual(pick({ limit: 1 }), ['superseded'])
assert.deepEqual(pick({}, 'superseded'), ['old']) // the caller's session is never backfilled
assert.deepEqual(pick({}, null), ['superseded', 'old']) // 'cur' is the newest and idle < 30 min → not ended
assert.deepEqual(pick({ now: Date.parse(at(90)) }, null), ['cur', 'superseded', 'old']) // …until it goes idle
assert.deepEqual(pick({ since: Date.parse(at(20)) }), ['superseded']) // ended before the last MEMORY.md write
assert.deepEqual(pick({}, 'cur', ['has_ep', 'old', 'superseded']), [])
assert.equal(lastEventTitle(bss.find(x => x.id === 'old')!, bf), 'T1 → done')
assert.equal(lastEventTitle(bss.find(x => x.id === 'reads')!, bf), undefined)

console.log('episodes: ok')
