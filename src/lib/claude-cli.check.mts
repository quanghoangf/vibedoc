// node src/lib/claude-cli.check.mts — runs claude-cli.ts against the fake CLI in e2e/fixtures/claude-stub (R081)
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { mcpAdd, mcpAddUser, mcpRemove, mcpRemoveUser, permissionModeChoices } from './claude-cli.ts'

const stub = path.resolve(import.meta.dirname, '../../e2e/fixtures/claude-stub')
const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-cli-'))
const PATH = process.env.PATH
try {
  process.env.PATH = path.join(root, 'nothing-here')
  const missing = await mcpAdd(root, 'http://localhost:3081/api/mcp')
  assert.equal(missing.ok, false)
  assert.equal(missing.missing, true)

  process.env.PATH = `${stub}${path.delimiter}${PATH}`
  const added = await mcpAdd(root, 'http://localhost:3081/api/mcp')
  assert.equal(added.ok, true)
  assert.match(added.stdout, /Added HTTP MCP server vibedoc with URL: http:\/\/localhost:3081\/api\/mcp/)
  const again = await mcpAdd(root, 'http://localhost:3081/api/mcp')
  assert.equal(again.ok, false)
  assert.equal(again.missing, false)
  assert.match(again.stderr, /already exists/)
  assert.equal((await mcpRemove(root)).ok, true)
  assert.equal(readFileSync(path.join(root, '.claude-stub.log'), 'utf8'),
    'mcp add --transport http vibedoc http://localhost:3081/api/mcp\n'.repeat(2) + 'mcp remove vibedoc -s local\n')
  console.log('claude-cli ok')

  // R104: the user-scope add stores the ${PWD} header template as written (no shell expands it)
  const user = await mcpAddUser(root, 'http://localhost:3081/api/mcp')
  assert.equal(user.ok, true)
  assert.match(user.stdout, /to user config/)
  assert.match(user.stdout, /"X-VibeDoc-Root": "\$\{PWD\}"/)
  assert.match((await mcpAddUser(root, 'http://localhost:3081/api/mcp')).stderr, /already exists in user config/)
  assert.equal((await mcpRemoveUser(root)).ok, true)
  assert.deepEqual(readFileSync(path.join(root, '.claude-stub.log'), 'utf8').trim().split('\n').slice(3), [
    'mcp add --scope user --transport http vibedoc http://localhost:3081/api/mcp --header X-VibeDoc-Root: ${PWD}',
    'mcp add --scope user --transport http vibedoc http://localhost:3081/api/mcp --header X-VibeDoc-Root: ${PWD}',
    'mcp remove vibedoc -s user',
  ])
  console.log('claude-cli user scope ok')
} finally {
  process.env.PATH = PATH
  rmSync(root, { recursive: true, force: true })
}

// R113 T588: the permission modes from `claude --help` (2.1.305's wrapped layout), none from an older help
const help = `  --permission-mode <mode>              Permission mode to use for the session
                                        (choices: "acceptEdits", "auto",
                                        "bypassPermissions", "manual",
                                        "dontAsk", "plan")
  --permission-prompts <target>         Who answers permission prompts with
                                        (choices: "host", "none", default:`
assert.deepEqual(permissionModeChoices(help), ['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan'])
assert.equal(permissionModeChoices('  --print  Print response and exit'), null)
console.log('claude-cli permission modes ok')
