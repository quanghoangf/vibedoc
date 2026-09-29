// Self-check for chat tabs. Run: node src/lib/chats.check.mts
import assert from 'node:assert/strict'
import { MAX_RUNNING_CHATS, TOO_MANY_CHATS, addChat, chatStatus, epicAgents, epicAgentStore, epicOf, newlyWaiting, waitingTitle, chatTitle, closeChat, patchChat, pendingReviews, routeAsk, runningChats, type Chat, type StatusMessage } from './chats.ts'

const two = addChat(addChat([], 'a'), 'b')
const busyB = patchChat(two, 'b', (c) => ({ ...c, busy: true }))
assert.equal(two.length, 2)
assert.equal(busyB[0], two[0]) // untouched chats keep their identity
assert.equal(busyB[1].busy, true)
assert.deepEqual(patchChat(two, 'gone', (c) => ({ ...c, busy: true })), two) // missing id → no-op

// routeAsk
assert.deepEqual(routeAsk(two, 'a'), { chatId: 'a' })                   // idle active → reuse
assert.deepEqual(routeAsk(busyB, 'b'), { newChat: true })               // busy active → new
assert.deepEqual(routeAsk(busyB, 'a'), { chatId: 'a' })                 // another chat busy doesn't matter
assert.deepEqual(routeAsk(two, 'a', { newChat: true }), { newChat: true })
assert.deepEqual(routeAsk([], null), { newChat: true })                 // no chats → new
assert.deepEqual(routeAsk(two, 'gone'), { newChat: true })              // stale active id → new

// routeAsk: cap on running chats (one `claude -p` each)
const busy = (n: number) => Array.from({ length: n }, (_, i) => patchChat(addChat([], `r${i}`), `r${i}`, (c) => ({ ...c, busy: true }))[0])
const idleA = addChat([], 'a')
assert.deepEqual(routeAsk([...busy(MAX_RUNNING_CHATS - 1), ...idleA], 'a', { newChat: true }), { newChat: true }) // one slot left
assert.deepEqual(routeAsk(busy(MAX_RUNNING_CHATS), 'r0', { newChat: true }), { refused: TOO_MANY_CHATS })
assert.deepEqual(routeAsk([...busy(MAX_RUNNING_CHATS), ...idleA], 'a'), { refused: TOO_MANY_CHATS })     // an idle tab would still start a 5th process
assert.deepEqual(routeAsk(idleA, 'a', { newChat: true, running: MAX_RUNNING_CHATS }), { refused: TOO_MANY_CHATS }) // explicit count beats stale chats
assert.equal(TOO_MANY_CHATS, 'Too many agents running (4). Close a tab or wait.')

// runningChats store
let heard = 0
const off = runningChats.subscribe(() => heard++)
runningChats.set(2); runningChats.set(2)
assert.deepEqual([runningChats.get(), heard], [2, 1]) // unchanged value → no notify
off(); runningChats.set(0)
assert.equal(heard, 1)

// chatTitle
assert.equal(chatTitle('Break down epic R004 into tasks.'), 'Break down R004')
assert.equal(chatTitle('again'), 'again')
assert.equal(chatTitle('Plan a roadmap for this project.'), 'Plan a roadmap for this projec…')
assert.equal(chatTitle('Break down this spec into tasks:\n\nlong spec'), 'Break down this spec into task…')

// closeChat
const three = addChat(two, 'c')
const ids = (r: { chats: Chat[] }) => r.chats.map((c) => c.id).join('')
assert.deepEqual({ ids: ids(closeChat(three, 'b', 'b')), active: closeChat(three, 'b', 'b').activeId }, { ids: 'ac', active: 'c' }) // active → right
assert.equal(closeChat(three, 'c', 'c').activeId, 'b')               // active, rightmost → left
assert.deepEqual({ ids: ids(closeChat(three, 'a', 'c')), active: closeChat(three, 'a', 'c').activeId }, { ids: 'bc', active: 'c' }) // inactive keeps active
assert.deepEqual(closeChat(addChat([], 'a'), 'a', 'a'), { chats: [], activeId: null }) // last → empty
assert.deepEqual(closeChat(three, 'gone', 'a'), { chats: three, activeId: 'a' })

// chatStatus: running > needs-answer > review > error > idle
const msg = (m: Partial<StatusMessage> = {}): StatusMessage => ({ role: 'assistant', questions: [], proposals: [], plans: [], ...m })
const chat = (messages: StatusMessage[], busy = false): Chat<StatusMessage> =>
  ({ id: 'x', title: 't', messages, sessionId: null, busy, notes: [], epicId: null })
const ask = msg({ questions: [{}] })
const plan = msg({ plans: [{ status: 'pending' }] })
const edit = msg({ proposals: [{ status: 'pending' }] })
const failed = msg({ error: 'boom' })
assert.equal(chatStatus(chat([])), 'idle')
assert.equal(chatStatus(chat([msg({ role: 'user' }), msg()])), 'idle')
assert.equal(chatStatus(chat([msg({ role: 'user' }), msg()], true)), 'running')
assert.equal(chatStatus(chat([ask])), 'needs-answer')
assert.equal(chatStatus(chat([msg({ questions: [{ answers: ['a'] }] })])), 'idle')    // answered
assert.equal(chatStatus(chat([ask, msg({ role: 'user' })])), 'idle')                  // typed past the card
assert.equal(chatStatus(chat([plan])), 'review')
assert.equal(chatStatus(chat([edit, msg({ role: 'user' }), msg()])), 'review')         // older pending card still counts
assert.equal(chatStatus(chat([msg({ plans: [{ status: 'accepted' }], proposals: [{ status: 'rejected' }] })])), 'idle')
assert.equal(chatStatus(chat([failed])), 'error')
assert.equal(chatStatus(chat([failed, msg({ role: 'user' }), msg()])), 'idle')         // only the last reply's error
assert.equal(chatStatus(chat([ask], true)), 'running')                                  // precedence
assert.equal(chatStatus(chat([msg({ questions: [{}], plans: [{ status: 'pending' }] })])), 'needs-answer')
assert.equal(chatStatus(chat([msg({ plans: [{ status: 'pending' }], error: 'boom' })])), 'review')
assert.equal(pendingReviews(chat([plan, edit, msg({ plans: [{ status: 'pending' }, { status: 'accepted' }] })])), 3)

// epicOf / epicAgents: the roadmap marker
assert.equal(epicOf('Break down epic R004 into tasks.'), 'R004')
assert.equal(epicOf('  break down epic r12 please'), 'R12')
assert.equal(epicOf('Break down the spec in docs/x.md into tasks.'), null)
assert.equal(chatTitle('Break down epic R004 into tasks.'), 'Break down R004')
const on = (id: string, epicId: string | null, messages: StatusMessage[], busy = false): Chat<StatusMessage> =>
  ({ ...chat(messages, busy), id, epicId })
assert.deepEqual(epicAgents([
  on('c1', 'R001', [msg()], true),                       // running
  on('c2', 'R002', [ask]),                               // needs-answer
  on('c3', 'R003', [plan]),                              // review
  on('c4', 'R004', [msg()]),                             // idle → nothing
  on('c5', 'R005', [failed]),                            // error → nothing
  on('c6', null, [msg()], true),                         // not an epic chat
]), {
  R001: { status: 'running', chatId: 'c1' },
  R002: { status: 'needs-answer', chatId: 'c2' },
  R003: { status: 'review', chatId: 'c3' },
})
// Two chats on one epic: the most urgent wins, whatever the order
assert.deepEqual(epicAgents([on('a', 'R009', [plan]), on('b', 'R009', [msg()], true)]), { R009: { status: 'running', chatId: 'b' } })
assert.deepEqual(epicAgents([on('b', 'R009', [ask]), on('a', 'R009', [plan])]), { R009: { status: 'needs-answer', chatId: 'b' } })
// The store only notifies on a real change
let hits = 0
const unsub = epicAgentStore.subscribe(() => hits++)
epicAgentStore.set({ R001: { status: 'running', chatId: 'c1' } })
epicAgentStore.set({ R001: { status: 'running', chatId: 'c1' } })
epicAgentStore.set({})
unsub()
assert.equal(hits, 2)

// newlyWaiting / waitingTitle: badge, page title, desktop notification
const w1 = on('w1', null, [ask]), w2 = on('w2', null, [plan]), w3 = on('w3', null, [msg()], true)
assert.deepEqual(newlyWaiting({}, [w1, w2, w3]).map((x) => [x.chat.id, x.status]), [['w1', 'needs-answer'], ['w2', 'review']])
assert.deepEqual(newlyWaiting({ w1: 'needs-answer', w2: 'running' }, [w1, w2]).map((x) => x.chat.id), ['w2'])  // already notified → once
assert.deepEqual(newlyWaiting({ w2: 'needs-answer' }, [w2]).map((x) => x.status), ['review'])                  // answered, now a plan
assert.equal(waitingTitle('VibeDoc', 2), '(2) VibeDoc')
assert.equal(waitingTitle('(2) VibeDoc', 3), '(3) VibeDoc')
assert.equal(waitingTitle('(3) VibeDoc', 0), 'VibeDoc')

console.log('chats: ok')
