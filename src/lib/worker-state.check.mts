// Self-check for worker-state. Run: node src/lib/worker-state.check.mts
import assert from 'node:assert/strict'
import { rateLimitPause, refusedCalls, sessionFromLog, sumUsage, turnOutcome, turnUsage, USAGE_PAUSE_AT, workerPhase } from './worker-state.ts'

// The spike's shapes (ADR-007): tool_use → system/permission_denied → result.permission_denials
const turn = [
  JSON.stringify({ type: 'system', subtype: 'init', session_id: 's' }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'git push --dry-run' } }] } }),
  JSON.stringify({ type: 'system', subtype: 'permission_denied', tool_name: 'Bash', tool_use_id: 'tu1', decision_reason_type: 'subcommandResults', message: 'Permission to use Bash with command git push --dry-run has been denied.' }),
  'not json',
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu2', name: 'Bash', input: { command: 'curl -sI https://example.com' } }] } }),
  JSON.stringify({ type: 'system', subtype: 'permission_denied', tool_name: 'Bash', tool_use_id: 'tu2', decision_reason_type: 'other', message: 'This command requires approval' }),
  JSON.stringify({ type: 'result', permission_denials: [
    { tool_name: 'Bash', tool_use_id: 'tu1', tool_input: { command: 'git push --dry-run' } },
    { tool_name: 'Bash', tool_use_id: 'tu2', tool_input: { command: 'curl -sI https://example.com' } },
  ] }),
]
assert.deepEqual(refusedCalls(turn), [{ tool: 'Bash', input: 'git push --dry-run' }, { tool: 'Bash', input: 'curl -sI https://example.com' }])

// Live: the system event alone already names the command (from its tool_use)
assert.deepEqual(refusedCalls(turn.slice(0, 3)), [{ tool: 'Bash', input: 'git push --dry-run' }])
// Parsed events work too; a denial without a tool_use falls back to the message
assert.deepEqual(refusedCalls([{ type: 'system', subtype: 'permission_denied', tool_name: 'Write', tool_use_id: 'x', message: 'denied' }]), [{ tool: 'Write', input: 'denied' }])
// Only the result: non-Bash input is its file path
assert.deepEqual(refusedCalls([{ type: 'result', permission_denials: [{ tool_name: 'Edit', tool_use_id: 'e', tool_input: { file_path: '/a.ts' } }] }]), [{ tool: 'Edit', input: '/a.ts' }])
assert.deepEqual(refusedCalls([{ type: 'result', is_error: false, result: 'ok' }]), [])

// T567: the spike's real excerpts (ADR-007 § Spike). Run C2, `--max-turns 2` with sequential calls: exit 1
const budget = { maxTurns: 60, timeoutMin: 30 }
const maxTurns = JSON.parse('{"type":"result","subtype":"error_max_turns","is_error":true,"terminal_reason":"max_turns","errors":["Reached maximum number of turns (2)"],"num_turns":3}')
assert.deepEqual(turnOutcome(maxTurns, { code: 1 }, 20_000, budget), { kind: 'over-turns' })
assert.deepEqual(turnOutcome({ terminal_reason: 'max_turns' }, { code: 1 }, 1, budget), { kind: 'over-turns' })
// Run A's result: a clean exit is done, and its numbers are the turn's usage
const runA = JSON.parse('{"type":"result","subtype":"success","is_error":false,"duration_ms":38000,"duration_api_ms":33000,"num_turns":14,"result":"Done","total_cost_usd":0.73,"usage":{"input_tokens":12,"cache_creation_input_tokens":66894,"cache_read_input_tokens":708649,"output_tokens":2437}}')
assert.deepEqual(turnOutcome(runA, { code: 0 }, 38_000, budget), { kind: 'done' })
assert.deepEqual(turnUsage(runA), { turns: 14, durationMs: 38000, costUsd: 0.73, tokens: 12 + 66894 + 708649 + 2437 })
assert.equal(turnUsage(null), null)
assert.deepEqual(turnUsage({ type: 'result' }), { turns: 0, durationMs: 0, costUsd: 0, tokens: 0 })
assert.deepEqual(sumUsage([turnUsage(runA), null, { turns: 1, durationMs: 2, costUsd: 0.27, tokens: 3 }]), { turns: 15, durationMs: 38002, costUsd: 1, tokens: 777995 })
// Killed by the server's timeout (no result event): over time, whatever the exit code
assert.deepEqual(turnOutcome(null, { code: null, timedOut: true }, 1_800_000, budget), { kind: 'over-time' })
assert.deepEqual(turnOutcome(null, { code: 143 }, 1_800_001, budget), { kind: 'over-time' })
assert.deepEqual(turnOutcome(null, { code: 1, stderr: 'boom' }, 5_000, budget), { kind: 'error' })
// Usage limit: the rejected shape was never observed, so a failure whose text names a limit counts
const now = Date.parse('2026-10-20T05:00:00Z')
const resets = 1792478400 // run A's resetsAt (seconds)
assert.deepEqual(turnOutcome({ is_error: true, result: 'Claude AI usage limit reached|1792478400' }, { code: 1 }, 1, budget, null, now), { kind: 'usage-limit', retryAt: new Date(resets * 1000).toISOString() })
assert.deepEqual(turnOutcome(null, { code: 1, stderr: 'API Error: 429 Too Many Requests' }, 1, budget, null, now), { kind: 'usage-limit', retryAt: null })
assert.deepEqual(turnOutcome({ is_error: true, result: "5-hour limit reached ∙ resets 3pm" }, { code: 1 }, 1, budget, { status: 'allowed', resetsAt: resets }, now), { kind: 'usage-limit', retryAt: new Date(resets * 1000).toISOString() })
assert.deepEqual(turnOutcome({ is_error: true, result: 'x' }, { code: 1 }, 1, budget, { status: 'rejected', resetsAt: resets }, now), { kind: 'usage-limit', retryAt: new Date(resets * 1000).toISOString() })
assert.deepEqual(turnOutcome({ is_error: true, result: 'limit reached|1000000000' }, { code: 1 }, 1, budget, null, now), { kind: 'usage-limit', retryAt: null }, 'a reset in the past gives no time')
assert.deepEqual(turnOutcome({ is_error: false, result: 'I hit no usage limit' }, { code: 0 }, 1, budget), { kind: 'done' }, 'a clean exit is never a limit')

// Run A's rate_limit_event: 43% used → no pause; at the threshold → pause until resetsAt
const info = JSON.parse('{"status":"allowed","rateLimitType":"five_hour","resetsAt":1792478400,"unifiedWindows":{"five_hour":{"utilization":0.43},"seven_day":{"utilization":0.06}}}')
assert.equal(rateLimitPause(info, now), null)
assert.equal(rateLimitPause({ ...info, unifiedWindows: { ...info.unifiedWindows, seven_day: { utilization: USAGE_PAUSE_AT } } }, now), new Date(resets * 1000).toISOString())
assert.equal(rateLimitPause({ ...info, status: 'rejected' }, now), new Date(resets * 1000).toISOString())
assert.equal(rateLimitPause({ ...info, status: 'rejected' }, resets * 1000 + 1), null, 'already reset')
assert.equal(rateLimitPause(null, now), null)


// T556: an adopted process has no exit code: its result decides
assert.deepEqual(turnOutcome(runA, { code: undefined }, 38_000, budget), { kind: 'done' })
assert.deepEqual(turnOutcome({ is_error: true, result: 'boom' }, { code: undefined }, 1, budget), { kind: 'error' })
assert.deepEqual(turnOutcome(maxTurns, { code: undefined }, 1, budget), { kind: 'over-turns' })
assert.deepEqual(turnOutcome(null, { code: undefined }, 1, budget), { kind: 'error' })
// own child killed by a signal (code null) still is not done
assert.deepEqual(turnOutcome(runA, { code: null }, 1, budget), { kind: 'error' })

// T556: what a restart finds
const st = { endedAt: null }
assert.equal(workerPhase(null, false, 'in-progress'), 'ended')
assert.equal(workerPhase({ endedAt: '2026-10-20T00:00:00Z' }, true, 'in-progress'), 'ended', 'already folded')
assert.equal(workerPhase(st, true, 'in-progress'), 'running')
assert.equal(workerPhase(st, true, 'done'), 'running', 'alive wins: it may still commit')
assert.equal(workerPhase(st, false, 'done'), 'between-tasks')
assert.equal(workerPhase(st, false, 'review'), 'between-tasks')
assert.equal(workerPhase(st, false, 'in-progress', true), 'between-tasks', 'a result (e.g. a question) is not an interruption')
assert.equal(workerPhase(st, false, 'in-progress'), 'interrupted')
assert.equal(workerPhase(st, false, null), 'interrupted')

assert.equal(sessionFromLog(turn), 's')
assert.equal(sessionFromLog(['stderr text', JSON.stringify({ type: 'assistant', session_id: 'later' })]), null)
assert.equal(sessionFromLog([]), null)

console.log('worker-state: ok')
