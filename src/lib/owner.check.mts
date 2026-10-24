// Self-check for owner parsing. Run: node src/lib/owner.check.mts
import assert from 'node:assert/strict'
import { agentFromUserAgent, ownerKind, ownerLabel, parseOwner, workerChatId, workerOwner } from './owner.ts'

assert.equal(parseOwner('human'), 'human')
assert.equal(parseOwner(' Human '), 'human')
assert.equal(parseOwner('ai:claude'), 'ai:claude')
assert.equal(parseOwner('AI: Cursor'), 'ai:cursor')
assert.equal(parseOwner('ai'), 'ai:agent')
assert.equal(parseOwner('—'), null)
assert.equal(parseOwner(''), null)
assert.equal(parseOwner(undefined), null)
assert.equal(parseOwner('bob'), null, 'unknown values are not owners')

assert.equal(ownerKind('human'), 'human')
assert.equal(ownerKind('ai:codex'), 'ai')
assert.equal(ownerKind(null), 'none')
assert.equal(ownerLabel('ai:codex'), 'codex')
assert.equal(ownerLabel('human'), 'Human')
assert.equal(ownerLabel(null), 'No owner')

assert.equal(agentFromUserAgent('claude-code/2.1.4 (external, cli)'), 'claude')
assert.equal(agentFromUserAgent('Cursor/1.2'), 'cursor')
assert.equal(agentFromUserAgent('Python-urllib/3.12'), 'agent')
assert.equal(agentFromUserAgent(null), 'agent')

// R108: a worker owner reads as what it ran, or removed; the raw id is never the label
assert.equal(workerChatId('ai:worker-c-mvgtml325ef8'), 'c-mvgtml325ef8')
assert.equal(workerChatId('ai:claude'), null)
assert.equal(workerChatId(null), null)
const chats = [{ id: 'c-a', worker: { target: { id: 'R108' } } }, { id: 'c-b' }]
assert.deepEqual(workerOwner('ai:worker-c-a', chats), { chatId: 'c-a', target: 'R108', removed: false })
assert.deepEqual(workerOwner('ai:worker-c-b', chats), { chatId: 'c-b', target: null, removed: false })
assert.deepEqual(workerOwner('ai:worker-c-gone', chats), { chatId: 'c-gone', target: null, removed: true })
assert.equal(workerOwner('ai:claude', chats), null)

console.log('owner.check: ok')
