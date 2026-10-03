// End-to-end check for R050's Done when: a chat that ends without calling the memory tool still leaves a readable
// session summary, and the next session starts from it.
//   1. One chat turn from the UI moves T001 to in-progress (no vibedoc_update_memory).
//   2. An episode lands in <fixture>/.vibedoc/episodes/<sessionId>.md.
//   3. A fresh vibedoc_read_memory shows it under "Since the last handoff".
//
//   pnpm build && PW_DIR=<dir with node_modules/playwright> node e2e/session-episodes.mjs
//
// Unlike the other chat e2es, /api/chat is NOT stubbed: the episode is written by the route after `claude -p` exits,
// so the real route must run. The script starts its own `next start` (the `.next` build — run `pnpm build` first) on a
// free port, with a fake `claude` first on PATH that makes the MCP call and prints stream-json. BASE is not used.
// Writes only into a fresh mktemp fixture and a mktemp bin dir.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { launchChrome, makeFixture } from "./stub-chat.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPLY = "Moved T001 to in-progress; the form validation is next."

const fx = makeFixture()
writeFileSync(path.join(fx, "plans/tasks/T001-form.md"), "# T001: Form\n**Status:** 📋 Todo\n**Phase:** R002\n\n## Goal\nA form.\n")

// Fake `claude -p`: one MCP tool call back into VibeDoc (as the real agent would), then a stream-json reply.
const binDir = mkdtempSync(path.join(tmpdir(), "vibedoc-fake-claude-"))
writeFileSync(path.join(binDir, "claude"), `#!/usr/bin/env node
const args = process.argv.slice(2)
const { url } = JSON.parse(args[args.indexOf("--mcp-config") + 1]).mcpServers.vibedoc
const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_update_task", arguments: { taskId: "T001", status: "in-progress", agent: "claude-code" } } }
fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(call) }).then(async (r) => {
  if (!r.ok) throw new Error("mcp " + r.status + " " + (await r.text()))
  const out = [
    { type: "assistant", session_id: "s1", message: { content: [{ type: "tool_use", id: "tu1", name: "mcp__vibedoc__vibedoc_update_task", input: call.params.arguments }] } },
    // Like the real CLI with --include-partial-messages: the UI renders the delta, the route reads the full message
    { type: "stream_event", session_id: "s1", event: { type: "content_block_delta", delta: { type: "text_delta", text: ${JSON.stringify(REPLY)} } } },
    { type: "assistant", session_id: "s1", message: { content: [{ type: "text", text: ${JSON.stringify(REPLY)} }] } },
    { type: "result", is_error: false, session_id: "s1" },
  ]
  process.stdout.write(out.map((l) => JSON.stringify(l)).join("\\n") + "\\n")
}).catch((e) => { console.error(e.message); process.exit(1) })
`)
chmodSync(path.join(binDir, "claude"), 0o755)

const port = await new Promise((resolve) => {
  const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)) })
})
const BASE = `http://localhost:${port}`
const server = spawn(path.join(REPO, "node_modules/.bin/next"), ["start", "-p", String(port)], {
  cwd: REPO, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, stdio: ["ignore", "ignore", "inherit"],
})
const serverExit = new Promise((resolve) => server.on("exit", resolve))

async function until(what, fn, ms = 30000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn().catch(() => null)
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}

async function mcp(name, args = {}) {
  const r = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const j = await r.json()
  assert.ok(!j.error, JSON.stringify(j.error))
  return j.result.content.map((c) => c.text).join("\n")
}

let browser
try {
  await until("next start", () => fetch(`${BASE}/api/projects`).then((r) => r.ok))
  browser = await launchChrome()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.route("**/api/projects", (route) =>
    route.fulfill({ json: [{ id: "fixture", name: "fixture", root: fx, hasVibedoc: true }] }))
  await page.goto(`${BASE}/board`)
  await page.waitForLoadState("networkidle")

  // 1. One real chat turn: the agent moves T001 and never calls vibedoc_update_memory
  await page.keyboard.press("c")
  const box = page.getByPlaceholder(/Ask the agent/)
  await box.fill("start T001")
  await box.press("Enter")
  await page.getByText(REPLY).waitFor({ timeout: 30000 })
  assert.match(readFileSync(path.join(fx, "plans/tasks/T001-form.md"), "utf8"), /\*\*Status:\*\* .*In-progress/i)
  assert.ok(!existsSync(path.join(fx, "memory/MEMORY.md")), "the turn wrote no handoff")
  console.log("ok  chat turn moved T001 without a memory update")

  // 2. The route wrote an episode after the turn (fire-and-forget after the stream closes, so poll)
  const dir = path.join(fx, ".vibedoc/episodes")
  const file = await until("episode file", async () => readdirSync(dir).find((f) => f.endsWith(".md")), 10000)
  const episode = readFileSync(path.join(dir, file), "utf8")
  assert.match(episode, /^# Episode ses_/m)
  assert.match(episode, /^\*\*Source:\*\* chat /m)
  assert.match(episode, /- T001 → in-progress/)
  assert.match(episode, new RegExp(`> ${REPLY}`))
  assert.match(episode, /- T001 Form \(in-progress\)/)
  console.log(`ok  episode written: .vibedoc/episodes/${file}`)

  // 3. The next session starts from it
  const memory = await mcp("vibedoc_read_memory")
  assert.match(memory, /## Since the last handoff \(auto, \d{4}-\d{2}-\d{2}\)/)
  assert.match(memory, /T001 → in-progress/)
  assert.match(memory, new RegExp(REPLY))
  console.log("ok  a fresh vibedoc_read_memory shows it under \"Since the last handoff\"")
} finally {
  await browser?.close()
  server.kill("SIGTERM")
  await serverExit
}
