// node src/lib/agent-connect.check.mts
import assert from 'node:assert/strict'
import { parseConnection, shouldRecordCall, claudeMcpAddCommand, RECORD_EVERY_MS } from './agent-connect.ts'

assert.equal(parseConnection(null), null)
assert.equal(parseConnection('not json'), null)
assert.equal(parseConnection('{"agent":"claude"}'), null)
assert.equal(parseConnection('{"agent":"claude","lastCall":"nope"}'), null)
assert.deepEqual(parseConnection('{"agent":"claude","lastCall":"2026-10-07T10:00:00.000Z","x":1}'), { agent: 'claude', lastCall: '2026-10-07T10:00:00.000Z' })

const prev = { agent: 'claude', lastCall: '2026-10-07T10:00:00.000Z' }
const t0 = Date.parse(prev.lastCall)
assert.equal(shouldRecordCall(null, 'claude', t0), true)
assert.equal(shouldRecordCall(prev, 'claude', t0 + 1000), false)
assert.equal(shouldRecordCall(prev, 'cursor', t0 + 1000), true)
assert.equal(shouldRecordCall(prev, 'claude', t0 + RECORD_EVERY_MS), true)

assert.equal(claudeMcpAddCommand('http://localhost:3081/api/mcp'), 'claude mcp add --transport http vibedoc http://localhost:3081/api/mcp')
console.log('agent-connect ok')

const { agentLabel } = await import('./agent-connect.ts')
assert.equal(agentLabel('claude'), 'Claude Code')
assert.equal(agentLabel('agent'), null)
assert.equal(agentLabel(null), null)
assert.equal(agentLabel('mybot'), 'mybot')
console.log('agentLabel ok')
