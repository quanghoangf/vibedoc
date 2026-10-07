// node src/lib/claude-cli.check.mts — runs claude-cli.ts against the fake CLI in e2e/fixtures/claude-stub (R081)
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { mcpAdd, mcpRemove } from './claude-cli.ts'

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
} finally {
  process.env.PATH = PATH
  rmSync(root, { recursive: true, force: true })
}
