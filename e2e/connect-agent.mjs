// Browser + MCP check for R081 (Connect your agent) on a fixture project.
//   1. /settings?tab=connect opens on the Connect panel; the MCP step waits for a call.
//   2. The panel's Test button (tools/list) and a plain initialize / tools/list POST leave it unticked.
//   3. A tools/call with a Claude Code User-Agent turns it ✓ "Claude Code" without a reload; a reload keeps it,
//      and a second call within 60s doesn't rewrite .vibedoc/agent-connection.json.
//   4. Connect Claude Code: the dialog shows the command and nothing runs until Confirm; Confirm runs
//      `claude mcp add` in the project and shows what changed; again → "already exists" + Replace → remove + add.
//   5. A cross-site POST is refused (403).
//   6. Skills: not installed → open; installed from outside (stub state) → ✓ + /vibedoc:roadmap without a reload;
//      Install asks first, then adds the marketplace and installs the plugin → ✓.
//   7. Cursor / Other (fresh fixture): paste config with the URL under mcpServers.vibedoc.url, no skills step;
//      a tools/call from Cursor ticks the MCP step ✓ "Cursor" live.
// The server must run with e2e/fixtures/claude-stub first on PATH (a fake `claude` that keeps its state in the cwd).
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH pnpm exec next dev -p 3081
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3081 node e2e/connect-agent.mjs
//
// Uses the real /api/mcp and routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const fx2 = makeFixture()
const evidence = path.join(fx, ".vibedoc/agent-connection.json")
const stubLog = path.join(fx, ".claude-stub.log")
const stubState = path.join(fx, ".claude-stub.json")
// commands that change something (the panel's status GET runs `plugin list --json` on its own)
const calls = () => (existsSync(stubLog) ? readFileSync(stubLog, "utf8").trim().split("\n") : []).filter((c) => !c.endsWith("list --json"))
const setStub = (patch) => writeFileSync(stubState, JSON.stringify({ ...JSON.parse(readFileSync(stubState, "utf8")), ...patch }))

async function rpc(method, params, ua = "e2e", root = fx) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(root)}`, {
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

  // 4. one-click connect, confirm first
  const step2 = page.getByRole("group", { name: "MCP server" })
  await step2.getByRole("button", { name: "Connect Claude Code" }).click()
  const dialog = page.getByRole("dialog", { name: "Add VibeDoc to Claude Code?" })
  await dialog.getByText(/claude mcp add --transport http vibedoc http:\/\/localhost:\d+\/api\/mcp/).waitFor()
  await dialog.getByText(fx).waitFor()
  assert.deepEqual(calls(), [], "nothing runs before Confirm")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  assert.deepEqual(calls(), [], "Cancel runs nothing")
  await step2.getByRole("button", { name: "Connect Claude Code" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Run it" }).click()
  await step2.getByText(/Added HTTP MCP server vibedoc with URL: http:\/\/localhost:\d+\/api\/mcp to local config/).waitFor()
  await step2.getByText(/File modified: .*\.claude\.json/).waitFor()
  assert.match(calls()[0], /^mcp add --transport http vibedoc http:\/\/localhost:\d+\/api\/mcp$/)
  console.log("✓ Connect asks first, then runs claude mcp add in the project and names what changed")

  await step2.getByRole("button", { name: "Connect Claude Code" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Run it" }).click()
  await step2.getByText("already exists in local config").waitFor()
  await step2.getByRole("button", { name: "Replace…" }).click()
  const replace = page.getByRole("dialog", { name: "Replace the vibedoc server in Claude Code?" })
  await replace.getByText("claude mcp remove vibedoc -s local").waitFor()
  assert.equal(calls().length, 2, "Replace runs nothing before its confirm")
  await replace.getByRole("button", { name: "Replace it" }).click()
  await step2.getByText(/Removed MCP server vibedoc/).waitFor()
  assert.deepEqual(calls().slice(2).map((c) => c.split(" ").slice(0, 2).join(" ")), ["mcp remove", "mcp add"])
  console.log("✓ already exists → Replace (after its confirm) runs remove then add")

  // 5. cross-site POST refused
  const cross = await fetch(`${BASE}/api/agent-connect?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ step: "mcp", url: "http://localhost:1/api/mcp" }),
  })
  assert.equal(cross.status, 403)
  assert.equal(calls().length, 4, "the refused POST ran nothing")
  console.log("✓ a cross-site POST is refused")

  // 6. skills step
  const skills = page.getByRole("group", { name: "Skills (/vibedoc:*)" })
  await skills.getByRole("button", { name: "Install the skills" }).waitFor()
  await skills.getByLabel("Not done yet").waitFor()
  setStub({ plugins: [{ id: "vibedoc@vibedoc", scope: "user", enabled: true }] })
  await skills.getByText("The vibedoc plugin is installed").waitFor({ timeout: 15000 })
  await skills.getByText("/vibedoc:roadmap", { exact: true }).waitFor()
  console.log("✓ a plugin installed outside VibeDoc ticks the skills step without a reload, with /vibedoc:roadmap next")

  setStub({ plugins: [{ id: "vibedoc@vibedoc", scope: "project", projectPath: "/elsewhere", enabled: true }] })
  await page.reload()
  await skills.getByLabel("Not done yet").waitFor()
  await skills.getByRole("button", { name: "Install the skills" }).click()
  const sd = page.getByRole("dialog", { name: "Install the vibedoc plugin in Claude Code?" })
  await sd.getByText("claude plugin marketplace add quanghoangf/vibedoc").waitFor()
  await sd.getByText("claude plugin install vibedoc@vibedoc").waitFor()
  const before = calls().length
  assert.equal(calls().length, before, "nothing runs before Confirm")
  await sd.getByRole("button", { name: "Run it" }).click()
  await skills.getByText("The vibedoc plugin is installed").waitFor()
  assert.deepEqual(calls().slice(before), ["plugin marketplace add quanghoangf/vibedoc", "plugin install vibedoc@vibedoc"])
  console.log("✓ Install asks first, then adds the marketplace and installs the plugin → ✓")

  // 7. Cursor / Other on a project no agent has called yet
  const page2 = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page2.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page2, [], { root: fx2 })
  await page2.goto(`${BASE}/settings?tab=connect`)
  await page2.getByRole("radio", { name: "Cursor" }).click()
  const mcp2 = page2.getByRole("group", { name: "MCP server" })
  await mcp2.getByText(".cursor/mcp.json").waitFor()
  const config = JSON.parse(await mcp2.locator("code").first().textContent())
  assert.match(config.mcpServers.vibedoc.url, /^http:\/\/localhost:\d+\/api\/mcp$/)
  assert.equal(await mcp2.getByRole("button", { name: "Connect Claude Code" }).count(), 0)
  assert.equal(await page2.getByRole("group", { name: "Skills (/vibedoc:*)" }).count(), 0)
  await mcp2.getByText("Start Cursor in this project").waitFor()
  await page2.getByRole("radio", { name: "Other" }).click()
  await mcp2.getByText("Or give it just the URL:").waitFor()
  await mcp2.getByText(/^http:\/\/localhost:\d+\/api\/mcp$/).waitFor()
  await page2.getByRole("radio", { name: "Cursor" }).click()
  await rpc("tools/call", { name: "vibedoc_get_status", arguments: {} }, "Cursor/1.7 (darwin)", fx2)
  await mcp2.getByText(/Connected · Cursor · last call/).waitFor({ timeout: 5000 })
  console.log("✓ Cursor / Other get the config to paste, no skills step, and the MCP step ticks on Cursor's first call")

  assert.deepEqual(errors, [], "no console errors")
  console.log("connect-agent: ok")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
  rmSync(fx2, { recursive: true, force: true })
}
