// Self-check for owner parsing. Run: node src/lib/owner.check.mts
import assert from 'node:assert/strict'
import { agentFromUserAgent, ownerKind, ownerLabel, parseOwner } from './owner.ts'

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

console.log('owner.check: ok')
