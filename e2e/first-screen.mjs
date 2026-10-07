// Browser check for R082 (smart first screen): `/` picks the first screen from what the project has.
//   S1  docs, no tasks/roadmap → /start, first start "Generate roadmap from your docs" (opens an agent chat)
//   S2  nothing → /start, "Plan the first epics with the agent"
//   set up (a task) → /board, never the welcome
//   S4  "Write project docs" → the template wizard (/setup); the agent row says connected once an `ai` event is logged
// Fixtures are temp dirs passed as ?root= (and as the only project via stubChat), removed in `finally`.
//
//   BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/first-screen.mjs
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const made = []
function project(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "vibedoc-first-"))
  made.push(dir)
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    writeFileSync(path.join(dir, f), body)
  }
  return dir
}

const withDocs = project({ "README.md": "# Shop\n\nA small web shop.\n", "docs/prd.md": "# PRD\n\nCheckout and catalog.\n" })
const empty = project({ "LICENSE.md": "MIT\n" })
const connected = project({ "docs/a.md": "# A\n", ".vibedoc-activity.json": JSON.stringify([
  { id: "e1", timestamp: new Date().toISOString(), type: "session_start", actor: "ai", title: "Session started", detail: "Agent connected" },
]) })
const setUp = project({ "README.md": "# App\n", "plans/tasks/T001-x.md": "# T001: First\n**Status:** 📋 Todo\n\n## Goal\nX.\n" })

const browser = await launchChrome()
const errors = []
async function open(root) {
  const ctx = await browser.newContext()
  await ctx.addCookies([{ name: "vibedoc-lang", value: "en", url: BASE }])
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  const chats = await stubChat(page, [{ type: "result", is_error: false, session_id: "s1" }], { root })
  await page.goto(`${BASE}/?root=${encodeURIComponent(root)}`)
  return { ctx, page, chats }
}

try {
  {
    const { ctx, page, chats } = await open(withDocs)
    await page.waitForURL(/\/start\b/)
    const start = page.getByRole("button", { name: "Generate roadmap from your docs" })
    await start.waitFor()
    assert.equal(await page.getByRole("button", { name: "Plan the first epics with the agent" }).count(), 0)
    await start.click()
    await page.getByRole("dialog").getByText("Plan a roadmap for this project from its docs.").first().waitFor()
    assert.match(JSON.stringify(chats[0] ?? {}), /from its docs/)
    console.log("ok  S1 docs project → welcome, generate roadmap from docs first, opens an agent chat")
    await ctx.close()
  }
  {
    const { ctx, page } = await open(empty)
    await page.waitForURL(/\/start\b/)
    await page.getByRole("button", { name: "Plan the first epics with the agent" }).waitFor()
    console.log("ok  S2 empty project → welcome, plan the first epics with the agent")
    await ctx.close()
  }
  {
    const { ctx, page } = await open(empty)
    await page.waitForURL(/\/start\b/)
    await page.getByText("No agent has connected yet.").waitFor()
    await page.getByRole("link", { name: "Write project docs" }).click()
    await page.waitForURL(/\/setup\b/)
    await page.getByRole("heading", { name: "Setup Wizard" }).waitFor()
    console.log("ok  S4 Write project docs → template wizard; agent row says not connected")
    await ctx.close()
  }
  {
    const { ctx, page } = await open(connected)
    await page.waitForURL(/\/start\b/)
    await page.getByText("Agent connected", { exact: true }).waitFor()
    console.log("ok  agent row says connected after an ai event")
    await ctx.close()
  }
  {
    const { ctx, page } = await open(setUp)
    await page.waitForURL(/\/board\b/)
    assert.equal(await page.getByRole("heading", { name: "Welcome to VibeDoc" }).count(), 0)
    console.log("ok  set-up project → board, no welcome")
    await ctx.close()
  }
  assert.deepEqual(errors, [], "no page errors")
} finally {
  await browser.close()
  for (const d of made) rmSync(d, { recursive: true, force: true })
}
