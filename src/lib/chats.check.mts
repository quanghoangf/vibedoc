// Self-check for chats. Run: node src/lib/chats.check.mts
import assert from 'node:assert/strict'
import {
  ERROR_ALARM_MS, MAX_RUNNING_CHATS, TOO_MANY_CHATS, addChat, ago, attentionQueue, attachContext, chatFor, chatStatus, chatTitle, defaultChat, epicOf,
  fromSaved, groupChats, isActionableError, itemAgents, newChatId, newlyWaiting, nextInQueue, patchChat, pendingReviews, routeAsk, shellStatus, suggestions,
  toSaved, waitingTitle, type Attach, type Chat, type StatusMessage,
} from './chats.ts'

const T = (min: number) => new Date(Date.UTC(2026, 8, 29, 9, min)).toISOString()
const msg = (m: Partial<StatusMessage> = {}): StatusMessage => ({ role: 'assistant', questions: [], proposals: [], plans: [], ...m })
const chat = (id: string, messages: StatusMessage[] = [msg()], o: Partial<Chat<StatusMessage>> = {}): Chat<StatusMessage> =>
  ({ id, title: id, messages, sessionId: null, busy: false, notes: [], attach: null, createdAt: T(0), updatedAt: T(0), ...o })
const ask = msg({ questions: [{}] })
const plan = msg({ plans: [{ status: 'pending' }] })
const edit = msg({ proposals: [{ status: 'pending' }] })
const failed = msg({ error: 'boom' })
const epic = (id: string): Attach => ({ kind: 'epic', id })
const task = (id: string): Attach => ({ kind: 'task', id })

// ids, addChat, patchChat
assert.match(newChatId(1790000000000, 0.123456), /^c-[a-z0-9]+$/)
assert.notEqual(newChatId(1, 0.1), newChatId(1, 0.2))
const added = addChat<StatusMessage>([], 'a', { attach: task('T055'), now: T(1) })
assert.equal(added[0].title, 'Task T055')
assert.deepEqual(added[0].attach, task('T055'))
assert.equal(added[0].updatedAt, T(1))
assert.equal(addChat([], 'b')[0].title, 'New chat')
assert.deepEqual(patchChat(added, 'missing', (c) => c), added)   // missing id is a no-op

// chatStatus precedence: running > needs-answer > review > error > idle
assert.equal(chatStatus(chat('x', [msg()], { busy: true })), 'running')
assert.equal(chatStatus(chat('x', [ask])), 'needs-answer')
assert.equal(chatStatus(chat('x', [msg({ questions: [{ answers: ['a'] }] })])), 'idle')
assert.equal(chatStatus(chat('x', [ask, msg({ role: 'user' })])), 'idle')              // typed past the card
assert.equal(chatStatus(chat('x', [plan])), 'review')
assert.equal(chatStatus(chat('x', [edit, msg({ role: 'user' }), msg()])), 'review')     // older pending card still counts
assert.equal(chatStatus(chat('x', [failed])), 'error')
assert.equal(chatStatus(chat('x', [failed, msg({ role: 'user' }), msg()])), 'idle')     // only the last reply's error
assert.equal(chatStatus(chat('x', [ask], { busy: true })), 'running')
assert.equal(chatStatus(chat('x', [msg({ questions: [{}], plans: [{ status: 'pending' }] })])), 'needs-answer')
assert.equal(chatStatus(chat('x', [msg({ plans: [{ status: 'pending' }], error: 'boom' })])), 'review')
assert.equal(pendingReviews(chat('x', [plan, edit, msg({ plans: [{ status: 'pending' }, { status: 'accepted' }] })])), 3)

// isActionableError: error status, updated within 24h, not dismissed
const at0 = Date.parse(T(0))
assert.equal(isActionableError(chat('x', [failed]), at0 + 60_000), true)
assert.equal(isActionableError(chat('x', [failed]), at0 + ERROR_ALARM_MS), false)       // stale
assert.equal(isActionableError(chat('x', [failed], { dismissed: true }), at0), false)
assert.equal(isActionableError(chat('x', [msg()]), at0), false)                        // not an error
assert.equal(isActionableError(chat('x', [failed], { busy: true }), at0), false)       // retrying
assert.equal(toSaved(chat('x', [failed], { dismissed: true }))?.dismissed, true)       // survives a save
assert.equal(fromSaved<StatusMessage>({ ...chat('x', [failed]), dismissed: true })?.dismissed, true)

// routeAsk
const idle = chat('i'), busy = chat('b', [msg()], { busy: true })
const none = { newChat: true, attach: null }
assert.deepEqual(routeAsk([idle], 'i'), { chatId: 'i' })
assert.deepEqual(routeAsk([busy], 'b'), none)
assert.deepEqual(routeAsk([idle], 'i', { newChat: true }), none)
assert.deepEqual(routeAsk([], null), none)
assert.deepEqual(routeAsk([idle], 'gone'), none)
const running = Array.from({ length: MAX_RUNNING_CHATS }, (_, i) => chat(`r${i}`, [msg()], { busy: true }))
assert.deepEqual(routeAsk(running, null), { refused: TOO_MANY_CHATS })
assert.deepEqual(routeAsk([idle], 'i', { running: MAX_RUNNING_CHATS }), { refused: TOO_MANY_CHATS })
// a chat waiting on the user (questions / review) is never written into
const asking = chat('q', [ask]), reviewing = chat('v', [msg({ plans: [{ status: 'pending' }] })])
assert.deepEqual(routeAsk([asking], 'q'), none)
assert.deepEqual(routeAsk([reviewing], 'v'), none)
// an ask about an item: never into another item's chat (the bug: R045 went into R051's chat waiting on answers)
const r051 = { kind: 'epic', id: 'R051' } as Attach, r045 = { kind: 'epic', id: 'R045' } as Attach
const r051Asking = chat('a51', [ask], { attach: r051 })
assert.deepEqual(routeAsk([r051Asking], 'a51', { target: r045 }), { newChat: true, attach: r045 })
assert.deepEqual(routeAsk([chat('i51', [msg()], { attach: r051 })], 'i51', { target: r045 }), { newChat: true, attach: r045 })
// … into its own chat when idle; open it (send nothing) when it is running or waiting on you
assert.deepEqual(routeAsk([chat('i45', [msg()], { attach: r045 }), idle], 'i', { target: r045 }), { chatId: 'i45' })
assert.deepEqual(routeAsk([chat('q45', [ask], { attach: r045 })], null, { target: r045 }), { open: 'q45' })
assert.deepEqual(routeAsk([chat('b45', [msg()], { attach: r045, busy: true })], null, { target: r045 }), { open: 'b45' })
// opening an existing item chat isn't refused at the cap; the newest chat for the item wins
assert.deepEqual(routeAsk([...running, chat('q45', [ask], { attach: r045 })], null, { target: r045 }), { open: 'q45' })
// newChat (the multi-epic dialog) still reuses the item's own idle chat instead of duplicating it
assert.deepEqual(routeAsk([chat('i45', [msg()], { attach: r045 })], null, { target: r045, newChat: true }), { chatId: 'i45' })
// a generic ask never lands in an item's chat
assert.deepEqual(routeAsk([chat('i51', [msg()], { attach: r051 })], 'i51'), none)

// epicOf, chatTitle
assert.equal(epicOf('Break down epic R004 into tasks.'), 'R004')
assert.equal(epicOf('  break down epic r12 please'), 'R12')
assert.equal(epicOf('Break down the spec in docs/x.md into tasks.'), null)
assert.equal(chatTitle('Break down epic R004 into tasks.'), 'Break down R004')
assert.equal(chatTitle('short'), 'short')
assert.equal(chatTitle('x'.repeat(60)), `${'x'.repeat(40)}…`)

// chatFor: the newest chat on the item
const onEpic = [chat('old', [msg()], { attach: epic('R4'), updatedAt: T(1) }), chat('new', [msg()], { attach: epic('R4'), updatedAt: T(5) }), chat('t', [msg()], { attach: task('R4') })]
assert.equal(chatFor(onEpic, epic('R4'))?.id, 'new')
assert.equal(chatFor(onEpic, task('R4'))?.id, 't')                                     // kind matters
assert.equal(chatFor(onEpic, epic('R5')), undefined)

// itemAgents: most urgent chat per item; idle/error/unattached show nothing
assert.deepEqual(itemAgents([
  chat('c1', [msg()], { busy: true, attach: epic('R1') }),
  chat('c2', [ask], { attach: task('T2') }),
  chat('c3', [plan], { attach: epic('R3') }),
  chat('c4', [msg()], { attach: epic('R4') }),
  chat('c5', [failed], { attach: epic('R5') }),
  chat('c6', [msg()], { busy: true }),
]), {
  'epic:R1': { status: 'running', chatId: 'c1' },
  'task:T2': { status: 'needs-answer', chatId: 'c2' },
  'epic:R3': { status: 'review', chatId: 'c3' },
})
assert.deepEqual(itemAgents([chat('a', [plan], { attach: epic('R9') }), chat('b', [msg()], { busy: true, attach: epic('R9') })]), { 'epic:R9': { status: 'running', chatId: 'b' } })

// attachContext / suggestions name only real tools and real actions
assert.match(attachContext(epic('R4')), /epic R4.*vibedoc_get_roadmap/)
assert.match(attachContext(task('T5')), /task T5.*vibedoc_get_task/)
assert.equal(suggestions(epic('R4'))[0], 'Break down epic R004'.replace('R004', 'R4') + ' into tasks.')
assert.equal(suggestions(task('T5')).length, 3)
assert.equal(suggestions(null).length, 3)

// groupChats / defaultChat
const g = groupChats([
  chat('idleOld', [msg()], { updatedAt: T(1) }),
  chat('idleNew', [msg()], { updatedAt: T(9) }),
  chat('run', [msg()], { busy: true, updatedAt: T(2) }),
  chat('wait1', [ask], { updatedAt: T(3) }),
  chat('wait2', [plan], { updatedAt: T(4) }),
])
assert.deepEqual([g.needsYou, g.running, g.recent].map((l) => l.map((c) => c.id)), [['wait2', 'wait1'], ['run'], ['idleNew', 'idleOld']])
assert.equal(defaultChat([chat('a', [msg()], { updatedAt: T(9) }), chat('b', [ask], { updatedAt: T(1) })])?.id, 'b')
assert.equal(defaultChat([]), undefined)

// attentionQueue: needs-you, then actionable errors (newest first); walking it; shellStatus
const qNow = Date.parse(T(10))
const errNew = chat('errNew', [failed], { updatedAt: T(8) })
const errOld = chat('errOld', [failed], { updatedAt: T(5) })
const queued = [chat('idle', [msg()], { updatedAt: T(9) }), errOld, chat('wait', [ask], { updatedAt: T(1) }), errNew,
  chat('gone', [failed], { dismissed: true }), chat('run', [msg()], { busy: true })]
const queue = attentionQueue(queued, qNow)
assert.deepEqual(queue.map((c) => c.id), ['wait', 'errNew', 'errOld'])
assert.deepEqual(groupChats(queued, qNow).recent.map((c) => c.id), ['idle', 'gone'])        // dismissed error isn't queued
assert.deepEqual(groupChats(queued).errors, [])                                             // no clock: errors stay in recent
assert.deepEqual(attentionQueue([errOld], Date.parse(T(5)) + ERROR_ALARM_MS), [])           // stale
assert.equal(defaultChat([chat('r', [msg()], { busy: true }), errOld], qNow)?.id, 'errOld')   // error beats running
assert.equal(defaultChat([chat('r', [msg()], { busy: true }), chat('i')], qNow)?.id, 'r')      // empty queue: running
assert.equal(nextInQueue(queue, null)?.id, 'wait')                                          // closed: head
assert.equal(nextInQueue(queue, 'idle')?.id, 'wait')                                        // not queued: head
assert.equal(nextInQueue(queue, 'wait')?.id, 'errNew')                                      // on the head: walk on
assert.equal(nextInQueue(queue, 'errOld'), undefined)                                       // past the end
assert.equal(shellStatus(errNew, qNow), 'error')
assert.equal(shellStatus(errNew, Date.parse(T(8)) + ERROR_ALARM_MS), 'idle')
assert.equal(shellStatus(chat('d', [failed], { dismissed: true }), qNow), 'idle')
assert.equal(shellStatus(chat('b', [failed], { busy: true }), qNow), 'running')

// toSaved / fromSaved
assert.equal(toSaved(chat('e', [])), null)                                              // empty chats aren't saved
assert.equal(toSaved(chat('s', [msg()], { busy: true }))?.busy, false)
const cut = fromSaved<StatusMessage>(chat('cut', [msg({ role: 'user', text: 'hi' }), msg({ text: '' })], { busy: true }))
assert.equal(cut?.busy, false)
assert.match(cut?.messages[1].error ?? '', /Interrupted/)
assert.equal(fromSaved<StatusMessage>(chat('ok', [msg({ text: 'done' })]))?.messages[0].error, undefined)
assert.equal(fromSaved<StatusMessage>(chat('card', [plan]))?.messages[0].error, undefined)   // a card-only reply isn't cut off
assert.equal(fromSaved<StatusMessage>(chat('tool', [msg({ tools: ['get_status'] })]))?.messages[0].error, undefined)  // nor a tool-only one
assert.equal(fromSaved(null), null)
assert.equal(fromSaved({ id: 1 }), null)
assert.deepEqual(fromSaved<StatusMessage>({ id: 'legacy', title: 't', messages: [msg({ text: 'x' })], sessionId: null })?.attach, null)

// newlyWaiting / waitingTitle
const w1 = chat('w1', [ask]), w2 = chat('w2', [plan]), w3 = chat('w3', [msg()], { busy: true })
assert.deepEqual(newlyWaiting({}, [w1, w2, w3]).map((x) => [x.chat.id, x.status]), [['w1', 'needs-answer'], ['w2', 'review']])
assert.deepEqual(newlyWaiting({ w1: 'needs-answer', w2: 'running' }, [w1, w2]).map((x) => x.chat.id), ['w2'])
assert.deepEqual(newlyWaiting({ w2: 'needs-answer' }, [w2]).map((x) => x.status), ['review'])
assert.equal(waitingTitle('VibeDoc', 2), '(2) VibeDoc')
assert.equal(waitingTitle('(2) VibeDoc', 3), '(3) VibeDoc')
assert.equal(waitingTitle('(3) VibeDoc', 0), 'VibeDoc')

// ago
const base = Date.parse(T(0))
assert.equal(ago(T(0), base + 30_000), 'now')
assert.equal(ago(T(0), base + 5 * 60_000), '5m')
assert.equal(ago(T(0), base + 3 * 3600_000), '3h')
assert.equal(ago(T(0), base + 50 * 3600_000), '2d')
assert.equal(ago(T(5), base), 'now')                                                    // future clamps to now

console.log('chats: ok')
