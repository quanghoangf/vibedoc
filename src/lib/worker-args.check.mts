// Self-check for worker-args. Run: node src/lib/worker-args.check.mts
import assert from 'node:assert/strict'
import { WORKER_CALL_HEADER, workerArgs, workerEnv } from './worker-args.ts'

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

// a custom allowlist replaces the default; the push / gh deny is always appended (T557)
const custom = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', allowed: ['Read', 'Bash(git push*)'] })
assert.deepEqual(custom.slice(custom.indexOf('--allowedTools')), ['--allowedTools', 'Read', 'Bash(git push*)', '--disallowedTools', 'Bash(git push*)', 'Bash(gh *)'])

// minimal env: base names only, a *_TOKEN var is dropped unless listed
const vibedocEnv = { PATH: '/bin', HOME: '/h', USER: 'u', SHELL: '/bin/zsh', LANG: 'en', TERM: 'xterm', TMPDIR: '/t', GITHUB_TOKEN: 'x', ANTHROPIC_API_KEY: 'k', AWS_SECRET_ACCESS_KEY: 's', NODE_ENV: 'production' }
assert.deepEqual(Object.keys(workerEnv(vibedocEnv)).sort(), ['HOME', 'LANG', 'PATH', 'SHELL', 'TERM', 'TMPDIR', 'USER'])
assert.equal(workerEnv(vibedocEnv, ['GITHUB_TOKEN']).GITHUB_TOKEN, 'x')
assert.equal(workerEnv(vibedocEnv, ['GITHUB_TOKEN']).ANTHROPIC_API_KEY, undefined)
assert.ok(!('MISSING' in workerEnv(vibedocEnv, ['MISSING'])), 'an unset listed name is left out, not ""')

console.log('worker-args: ok')
