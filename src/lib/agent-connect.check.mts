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

const { validMcpUrl, mcpAlreadyExists } = await import('./agent-connect.ts')
assert.equal(validMcpUrl('http://localhost:3081/api/mcp'), true)
assert.equal(validMcpUrl('https://x.dev/api/mcp?root=/a'), true)
assert.equal(validMcpUrl('file:///etc/passwd'), false)
assert.equal(validMcpUrl('http://a b'), false)
assert.equal(validMcpUrl('--scope=user'), false)
assert.equal(validMcpUrl(42), false)
assert.equal(mcpAlreadyExists('MCP server vibedoc already exists in local config'), true)
assert.equal(mcpAlreadyExists('Added HTTP MCP server vibedoc'), false)
console.log('validMcpUrl ok')

const { pluginInstalled, hasVibedocMarketplace } = await import('./agent-connect.ts')
const user = { id: 'vibedoc@vibedoc', scope: 'user', enabled: true }
assert.equal(pluginInstalled([user], '/p'), true)
assert.equal(pluginInstalled([{ ...user, id: 'vibedoc@fork' }], '/p'), true)
assert.equal(pluginInstalled([{ ...user, enabled: false }], '/p'), false)
assert.equal(pluginInstalled([{ ...user, scope: 'project', projectPath: '/other' }], '/p'), false)
assert.equal(pluginInstalled([{ ...user, scope: 'local', projectPath: '/p' }], '/p'), true)
assert.equal(pluginInstalled([{ ...user, id: 'vibedocs@x' }], '/p'), false)
assert.equal(pluginInstalled('nope', '/p'), false)
assert.equal(hasVibedocMarketplace([{ name: 'caveman' }, { name: 'vibedoc' }]), true)
assert.equal(hasVibedocMarketplace([{ name: 'caveman' }]), false)
assert.equal(hasVibedocMarketplace(null), false)
console.log('pluginInstalled ok')

const { mcpServersConfig } = await import('./agent-connect.ts')
assert.deepEqual(JSON.parse(mcpServersConfig('http://localhost:3081/api/mcp')), { mcpServers: { vibedoc: { url: 'http://localhost:3081/api/mcp' } } })
console.log('mcpServersConfig ok')
