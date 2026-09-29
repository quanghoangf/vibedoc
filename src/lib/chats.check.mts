// Self-check for chat tabs. Run: node src/lib/chats.check.mts
import assert from 'node:assert/strict'
import { addChat, chatStatus, chatTitle, closeChat, patchChat, pendingReviews, routeAsk, type Chat, type StatusMessage } from './chats.ts'

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
  ({ id: 'x', title: 't', messages, sessionId: null, busy, notes: [] })
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

console.log('chats: ok')
