// Browser check for R084 (first-week checklist), on a fresh empty fixture project:
//   1. The sidebar shows "First week" 0/6, every row unticked
//   2. A human moves a task to done → "First task done" stays unticked
//   3. An agent claims and finishes a task over /api/mcp → "First task done" ticks without a reload (S1)
//   5. Dismiss → gone, after a reload too; Undo brings it back; another project still shows it (S3)
//   4. The first unticked step is open with its page or exact command; Copy copies it; commands carry real ids (S2)
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3084 pnpm dev   # then:
//   BASE=http://localhost:3084 PW_DIR=<dir with node_modules/playwright> node e2e/first-week.mjs
import assert from "node:assert/strict"
import { existsSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3084"
const fx = makeFixture()
const other = makeFixture()
rmSync(path.join(fx, "plans/roadmap"), { recursive: true }) // a project with nothing yet
const q = `?root=${encodeURIComponent(fx)}`
const task = (id, title) => writeFileSync(path.join(fx, `plans/tasks/${id}-${title.toLowerCase()}.md`),
  [`# ${id}: ${title}`, "**Status:** 📋 Todo", "**Depends on:** —", "", "## Goal", "x", ""].join("\n"))
task("T001", "Alpha")
task("T002", "Bravo")

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

const browser = await launchChrome()
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/board`)
  const fw = page.getByRole("group", { name: "First week" })
  const row = (id) => fw.locator(`[data-step="${id}"]`)
  await fw.getByText("0 of 6 steps done").waitFor()
  for (const id of ["agent", "roadmap", "breakdown", "taskDone", "testRun", "memory"]) {
    assert.equal(await row(id).getAttribute("data-done"), null, `${id} unticked on an empty project`)
  }
  console.log("ok  empty project: First week 0/6, every row unticked")

  // S2: the next step is open with the exact command, one click to copy
  const action = fw.getByTestId("first-week-action")
  const mcpAdd = `claude mcp add --transport http vibedoc ${BASE}/api/mcp`
  await action.getByText(mcpAdd, { exact: true }).waitFor()
  assert.equal(await action.count(), 1, "only one step open")
  assert.equal(await row("agent").getByRole("button", { expanded: true }).count(), 1)
  await action.getByRole("button", { name: `Copy command: ${mcpAdd}` }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), mcpAdd)
  assert.equal(await action.getByRole("link", { name: "Open /settings" }).getAttribute("href"), "/settings")
  console.log("ok  S2: the first unticked step shows the claude mcp add command for this server; Copy copies it")

  // A human's done is not the agent's
  const res = await fetch(`${BASE}/api/tasks${q}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: "T001", status: "done", actor: "human" }),
  })
  assert.equal(res.status, 200)
  await page.reload()
  await fw.getByText("0 of 6 steps done").waitFor()
  assert.equal(await row("taskDone").getAttribute("data-done"), null)
  console.log("ok  a task a human moves to done doesn't tick \"First task done\"")

  // S1: the agent claims and finishes T002; no reload
  const nav = await page.evaluate(() => performance.getEntriesByType("navigation").length)
  assert.match(await mcp("vibedoc_update_task", { taskId: "T002", status: "in-progress" }), /T002/)
  assert.match(await mcp("vibedoc_update_task", { taskId: "T002", status: "done" }), /T002/)
  await fw.locator('[data-step="taskDone"][data-done]').waitFor({ timeout: 5000 })
  await fw.locator('[data-step="agent"][data-done]').waitFor()
  await fw.getByText("2 of 6 steps done").waitFor()
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), nav, "no reload")
  console.log("ok  S1: the agent finishes a task → \"First task done\" (and \"Agent connected\") tick without a reload")

  // The open step follows the ticks: roadmap → breakdown with the real epic id
  await action.getByText("/vibedoc:roadmap", { exact: true }).waitFor()
  assert.equal(await action.getByRole("link", { name: "Open /roadmap" }).getAttribute("href"), "/roadmap")
  await mcp("vibedoc_create_roadmap_item", { title: "Now" })
  assert.match(await mcp("vibedoc_create_roadmap_item", { title: "Checkout", parent: "R001" }), /R002/)
  await fw.locator('[data-step="roadmap"][data-done]').waitFor({ timeout: 5000 })
  await action.getByText("/vibedoc:breakdown R002", { exact: true }).waitFor()
  // Another step opens on click; the open one closes on a second click
  await row("memory").getByRole("button").click()
  await action.getByRole("link", { name: "Open /memory" }).waitFor()
  await row("memory").getByRole("button").click()
  assert.equal(await action.count(), 0)
  console.log("ok  after the roadmap ticks, the open step is /vibedoc:breakdown R002; rows open and close on click")

  // S3: dismiss for this project only
  await fw.getByRole("button", { name: "Dismiss checklist" }).click()
  await fw.waitFor({ state: "detached" })
  await page.getByText("First-week checklist dismissed for this project").waitFor()
  assert.ok(existsSync(path.join(fx, ".vibedoc/first-week.json")))
  await page.getByRole("button", { name: "Undo" }).click()
  await fw.waitFor()
  assert.ok(!existsSync(path.join(fx, ".vibedoc/first-week.json")))
  await fw.getByRole("button", { name: "Dismiss checklist" }).click()
  await fw.waitFor({ state: "detached" })
  await page.reload()
  await page.getByRole("link", { name: "Board" }).first().waitFor()
  await page.getByRole("group", { name: "Chats" }).waitFor()
  assert.equal(await fw.count(), 0, "still dismissed after a reload")
  const page2 = await context.newPage()
  await stubChat(page2, [], { root: other })
  await page2.goto(`${BASE}/board`)
  await page2.getByRole("group", { name: "First week" }).getByText("1 of 6 steps done").waitFor() // the stock fixture has a roadmap
  await page2.close()
  console.log("ok  S3: dismiss hides it (Undo brings it back), a reload keeps it hidden, another project still shows it")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
  rmSync(other, { recursive: true, force: true })
}
