// Self-check for chat tabs. Run: node src/lib/chats.check.mts
import assert from 'node:assert/strict'
import { addChat, chatTitle, patchChat, routeAsk } from './chats.ts'

const two = addChat(addChat([], 'a'), 'b')
const busyB = patchChat(two, 'b', (c) => ({ ...c, busy: true }))
assert.equal(two.length, 2)
assert.equal(busyB[0], two[0]) // untouched chats keep their identity
assert.equal(busyB[1].busy, true)

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

console.log('chats: ok')
