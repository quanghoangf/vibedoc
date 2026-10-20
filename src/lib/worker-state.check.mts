// Self-check for worker-state. Run: node src/lib/worker-state.check.mts
import assert from 'node:assert/strict'
import { refusedCalls } from './worker-state.ts'

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

console.log('worker-state: ok')
