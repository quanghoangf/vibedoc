// Self-check for worker-args. Run: node src/lib/worker-args.check.mts
import assert from 'node:assert/strict'
import { VERIFY_ALLOWED, WORKER_ALLOWED, WORKER_CALL_HEADER, effectiveWorkerMode, WORKER_SYSTEM_PROMPT, verifyPrompt, workerArgs, workerEnv } from './worker-args.ts'

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

// T558: the ask rule on every turn
assert.equal(after('--append-system-prompt'), WORKER_SYSTEM_PROMPT)
assert.match(WORKER_SYSTEM_PROMPT, /vibedoc_ask_questions and end your turn/)

// T558: an answer resumes that task's session with the answer as the prompt; every other flag stays
const resumed = workerArgs({ taskId: 'T554', mainRoot: '/repo main', mcpOrigin: 'http://localhost:3333', workerId: 'c-abc', pluginDir: '/vibedoc/plugin', resume: { sessionId: 's-1', message: 'Answers:\n- Scope: A' } })
assert.deepEqual(resumed.slice(0, 4), ['-p', 'Answers:\n- Scope: A', '--resume', 's-1'])
assert.deepEqual(resumed.slice(4), args.slice(2))

// a custom allowlist replaces the default; the push / gh deny is always appended (T557)
const custom = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', allowed: ['Read', 'Bash(git push*)'] })
assert.deepEqual(custom.slice(custom.indexOf('--allowedTools')), ['--allowedTools', 'Read', 'Bash(git push*)', '--disallowedTools', 'Bash(git push*)', 'Bash(gh *)', 'mcp__vibedoc__vibedoc_propose_run'])

// minimal env: base names only, a *_TOKEN var is dropped unless listed
const vibedocEnv = { PATH: '/bin', HOME: '/h', USER: 'u', SHELL: '/bin/zsh', LANG: 'en', TERM: 'xterm', TMPDIR: '/t', GITHUB_TOKEN: 'x', ANTHROPIC_API_KEY: 'k', AWS_SECRET_ACCESS_KEY: 's', NODE_ENV: 'production' }
assert.deepEqual(Object.keys(workerEnv(vibedocEnv)).sort(), ['HOME', 'LANG', 'PATH', 'SHELL', 'TERM', 'TMPDIR', 'USER'])
assert.equal(workerEnv(vibedocEnv, ['GITHUB_TOKEN']).GITHUB_TOKEN, 'x')
assert.equal(workerEnv(vibedocEnv, ['GITHUB_TOKEN']).ANTHROPIC_API_KEY, undefined)
assert.ok(!('MISSING' in workerEnv(vibedocEnv, ['MISSING'])), 'an unset listed name is left out, not ""')

// T567: the turn budget is --max-turns; none given = no flag
assert.ok(!args.includes('--max-turns'))
const budgeted = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', maxTurns: 60 })
assert.equal(budgeted[budgeted.indexOf('--max-turns') + 1], '60')

// T568 + R113 T588: a review turn is fresh and never edits: R067's prompt, no Edit/Write; it may run checks
const review = workerArgs({ taskId: 'T554', mainRoot: '/repo main', mcpOrigin: 'http://localhost:3333', workerId: 'c-abc', pluginDir: '/vibedoc/plugin', allowed: ['Edit'], resume: { sessionId: 's-1', message: 'x' }, verify: true })
const rAfter = (flag: string) => review[review.indexOf(flag) + 1]
assert.equal(rAfter('-p'), verifyPrompt('T554'))
assert.match(verifyPrompt('T554'), /^Verify task T554: call vibedoc_verify_context, then vibedoc_report_findings\.$/)
assert.ok(!review.includes('--resume') && !review.includes('--plugin-dir') && !review.includes('--append-system-prompt'))
assert.equal(rAfter('--tools'), 'Read,Glob,Grep,Bash')
assert.deepEqual(review.slice(review.indexOf('--allowedTools') + 1, review.indexOf('--disallowedTools')), VERIFY_ALLOWED)
assert.ok(!VERIFY_ALLOWED.some(a => /^(Edit|Write)$|git (add|commit|push)|^Bash\(gh /.test(a)), 'a review never edits, commits or pushes')
assert.ok(['Bash(node *)', 'Bash(pnpm *)', 'Bash(tail *)', 'Bash(grep *)'].every(a => VERIFY_ALLOWED.includes(a)), 'a review runs the checks')
assert.equal(rAfter('--mcp-config'), after('--mcp-config'))
assert.equal(rAfter('--setting-sources'), 'project,local')
assert.ok(review.slice(review.indexOf('--disallowedTools')).includes('Bash(git push*)'))

// R113 T588: every turn has a --permission-mode: the worker's (auto), Accept edits for a worker from before
assert.equal(after('--permission-mode'), 'acceptEdits', 'no mode given (a worker from before R113)')
const auto = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', permissionMode: 'auto' })
assert.equal(auto[auto.indexOf('--permission-mode') + 1], 'auto')
const autoReview = workerArgs({ taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', permissionMode: 'auto', verify: true })
assert.equal(autoReview[autoReview.indexOf('--permission-mode') + 1], 'auto')
assert.equal(autoReview[autoReview.indexOf('--tools') + 1], 'Read,Glob,Grep,Bash', 'auto review still has no Edit/Write')
for (const a of [auto, autoReview]) assert.ok(a.slice(a.indexOf('--disallowedTools')).includes('Bash(git push*)') && a.includes('Bash(gh *)'), 'push / gh denied in auto too')
assert.ok(!auto.includes('bypassPermissions'))
// the default allowlist covers a compound command's usual tails (Accept edits checks every part)
assert.ok(['Bash(tail *)', 'Bash(head *)', 'Bash(echo *)', 'Bash(grep *)', 'Bash(node *)'].every(a => WORKER_ALLOWED.includes(a)))
// Auto only when this CLI lists it
assert.deepEqual(effectiveWorkerMode('auto', ['acceptEdits', 'auto', 'plan']), { mode: 'auto', fallback: false })
assert.deepEqual(effectiveWorkerMode('auto', ['acceptEdits', 'plan']), { mode: 'acceptEdits', fallback: true })
assert.deepEqual(effectiveWorkerMode('auto', null), { mode: 'acceptEdits', fallback: true })
assert.deepEqual(effectiveWorkerMode('acceptEdits', null), { mode: 'acceptEdits', fallback: false })

// R113 T589: the user's setup: user settings and Claude Code's default tools, MCP still only VibeDoc's unless asked
const base = { taskId: 'T1', mainRoot: '/r', mcpOrigin: 'http://h', workerId: 'w', pluginDir: '/p', permissionMode: 'auto' as const }
const mine = workerArgs({ ...base, setup: 'mine' })
assert.equal(mine[mine.indexOf('--setting-sources') + 1], 'user,project,local')
assert.ok(!mine.includes('--tools'), "the user's setup: Claude Code's default tool set")
assert.ok(mine.includes('--strict-mcp-config'), "the user's MCP servers stay out unless asked")
assert.equal(mine[mine.indexOf('--plugin-dir') + 1], '/p', "VibeDoc's plugin still loads (the spike: no duplicate when installed too)")
const mineMcp = workerArgs({ ...base, setup: 'mine', userMcp: true })
assert.ok(!mineMcp.includes('--strict-mcp-config'))
assert.ok(mineMcp.includes('--mcp-config'), "VibeDoc's server is still passed")
const isolatedMcp = workerArgs({ ...base, setup: 'isolated', userMcp: true })
assert.ok(isolatedMcp.includes('--strict-mcp-config') && isolatedMcp[isolatedMcp.indexOf('--setting-sources') + 1] === 'project,local', 'userMcp only means something with mine')
const mineReview = workerArgs({ ...base, setup: 'mine', userMcp: true, verify: true })
assert.equal(mineReview[mineReview.indexOf('--tools') + 1], 'Read,Glob,Grep,Bash', "a review never edits, whoever's setup")
for (const a of [mine, mineMcp, mineReview]) assert.ok(a.slice(a.indexOf('--disallowedTools')).includes('Bash(git push*)') && a.includes('Bash(gh *)'))

console.log('worker-args: ok')
