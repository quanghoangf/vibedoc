// Self-check for worker-args. Run: node src/lib/worker-args.check.mts
import assert from 'node:assert/strict'
import { WORKER_CALL_HEADER, workerArgs } from './worker-args.ts'

const args = workerArgs({ taskId: 'T554', mainRoot: '/repo main', mcpOrigin: 'http://localhost:3333', workerId: 'c-abc', pluginDir: '/vibedoc/plugin' })
const after = (flag: string) => args[args.indexOf(flag) + 1]

assert.equal(args[0], '-p')
assert.match(after('-p'), /^\/vibedoc:work T554\n/)
assert.match(after('-p'), /never call vibedoc_next_task/)
assert.match(after('-p'), /plans\/tasks\/\*/)
assert.match(after('-p'), /Never push/)

// MCP points at the main checkout, marked as a worker call
const mcp = JSON.parse(after('--mcp-config')).mcpServers.vibedoc
assert.equal(new URL(mcp.url).searchParams.get('root'), '/repo main')
assert.equal(mcp.headers[WORKER_CALL_HEADER], 'c-abc')
assert.ok(args.includes('--strict-mcp-config'))

// project settings only, six built-ins (never the chat's empty --tools), the plugin
assert.equal(after('--setting-sources'), 'project,local')
assert.equal(after('--tools'), 'Bash,Edit,Write,Read,Glob,Grep')
assert.equal(after('--plugin-dir'), '/vibedoc/plugin')
assert.ok(!args.includes('--disable-slash-commands'))

// fresh session, push denied, never bypass
assert.ok(!args.includes('--resume'))
assert.ok(args.slice(args.indexOf('--disallowedTools')).includes('Bash(git push*)'))
assert.ok(args.slice(args.indexOf('--disallowedTools')).includes('Bash(gh *)'))
assert.ok(!args.includes('bypassPermissions'))
const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'))
assert.ok(allowed.includes('mcp__vibedoc__*') && !allowed.some(a => a.startsWith('Bash(git push')))

// custom lists replace the defaults
const custom = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', allowed: ['Read'], denied: ['Bash(rm *)'] })
assert.deepEqual(custom.slice(custom.indexOf('--allowedTools')), ['--allowedTools', 'Read', '--disallowedTools', 'Bash(rm *)'])

console.log('worker-args: ok')
