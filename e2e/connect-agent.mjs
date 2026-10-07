// Browser + MCP check for R081 (Connect your agent) on a fixture project.
//   1. /settings?tab=connect opens on the Connect panel; the MCP step waits for a call.
//   2. The panel's Test button (tools/list) and a plain initialize / tools/list POST leave it unticked.
//   3. A tools/call with a Claude Code User-Agent turns it ✓ "Claude Code" without a reload; a reload keeps it,
//      and a second call within 60s doesn't rewrite .vibedoc/agent-connection.json.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3081 node e2e/connect-agent.mjs
//
// Uses the real /api/mcp and routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readFileSync, rmSync, statSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const evidence = path.join(fx, ".vibedoc/agent-connection.json")

async function rpc(method, params, ua = "e2e") {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": ua },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  return res.json()
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. deep link → panel, waiting
  await page.goto(`${BASE}/settings?tab=connect`)
  const panel = page.getByRole("region", { name: "Connect your agent" })
  await panel.waitFor()
  const step = page.getByRole("group", { name: "MCP server" })
  await step.getByText("claude mcp add --transport http vibedoc http://localhost").waitFor()
  await step.getByText("Waiting for the first call").waitFor()
  console.log("✓ /settings?tab=connect shows the MCP step waiting")

  // 2. health checks don't count
  await page.getByRole("button", { name: "Test" }).click()
  await page.getByText("Connection successful").waitFor()
  await rpc("initialize", {}, "claude-code/2.1.292")
  await rpc("tools/list", {}, "claude-code/2.1.292")
  await page.waitForTimeout(500)
  await step.getByText("Waiting for the first call").waitFor()
  assert.throws(() => statSync(evidence), "no evidence file after health checks")
  console.log("✓ Test button, initialize and tools/list leave the step unticked")

  // 3. first tool call → ✓ live
  await rpc("tools/call", { name: "vibedoc_get_status", arguments: {} }, "claude-code/2.1.292 (cli)")
  await step.getByText(/Connected · Claude Code · last call/).waitFor({ timeout: 5000 })
  console.log("✓ a tools/call ticks the step live with the agent's name")

  const first = readFileSync(evidence, "utf8")
  await rpc("tools/call", { name: "vibedoc_get_status", arguments: {} }, "claude-code/2.1.292 (cli)")
  await page.waitForTimeout(300)
  assert.equal(readFileSync(evidence, "utf8"), first, "a second call within 60s doesn't rewrite the file")
  await page.reload()
  await page.getByRole("group", { name: "MCP server" }).getByText(/Connected · Claude Code/).waitFor()
  console.log("✓ reload keeps ✓; a second call within 60s doesn't rewrite the evidence")

  assert.deepEqual(errors, [], "no console errors")
  console.log("connect-agent: ok")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
