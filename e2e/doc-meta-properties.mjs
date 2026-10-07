// Browser check for T505 (R095 S2): a task's / epic's `**Key:** Value` block shows as property rows in /docs.
//   1. A task file: Status, Phase, Size, Depends on, Covers, Owner, Due, Started are rows; the run-on paragraph
//      is gone from the body; a `**Key:**` line lower in the body and one inside a code fence are untouched
//   2. Status from the row: the file's line changes, the board API moves the task, the row shows it, the Split
//      editor's buffer gets the new line; a failed move rolls back with the toast
//   3. Phase chip → /roadmap?item=R002, Depends on chip → /board?task=T002
//   4. An epic file shows Parent, Status, Order, Tasks as rows
//   5. A doc without a meta block renders as before (no meta rows)
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3195 pnpm dev   # then:
//   BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@<v>/node_modules/playwright node e2e/doc-meta-properties.mjs
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3195"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
// unique per run: the Yjs room is the doc path, on a ws server other checkouts may share
const T1 = `plans/tasks/T001-alpha-${Date.now()}.md`
writeFileSync(path.join(fx, T1), [
  "# T001: Alpha", "**Status:** 📋 Todo", "**Phase:** R002 — Epic", "**Size:** S", "**Depends on:** T002", "**Covers:** S1",
  "**Owner:** human", "**Due:** 2026-12-01", "**Started:** 2026-10-01", "",
  "## Goal", "Alpha body.", "", "**Note:** lower in the body", "", "```md", "**Status:** fenced", "```", "",
].join("\n"))
writeFileSync(path.join(fx, "plans/tasks/T002-bravo.md"), "# T002: Bravo\n**Status:** 📋 Todo\n\n## Goal\nBravo.\n")
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002\n\nEpic body.\n")
mkdirSync(path.join(fx, "docs"), { recursive: true })
const plain = "# Plain\n\nSome text.\n\n**Key:** not a property\n"
writeFileSync(path.join(fx, "docs/plain.md"), plain)

const browser = await launchChrome()
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico") && !m.text().includes("Failed to load resource")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const props = page.locator("header dl").first()
  const labels = async () => (await props.locator("dt").allInnerTexts()).map((s) => s.trim())
  const body = page.locator(".doc-preview")

  // 1. rows, not a paragraph
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent(T1)}`)
  await body.getByText("Alpha body.").waitFor()
  const l = await labels()
  for (const k of ["Status", "Phase", "Size", "Depends on", "Covers", "Owner", "Due", "Started"]) assert.ok(l.includes(k), `row ${k} in ${l}`)
  const text = await body.innerText()
  assert.ok(!/Phase:/.test(text) && !/Depends on:/.test(text), "meta paragraph gone from the body")
  assert.match(text, /Note: lower in the body/)
  assert.match(text, /\*\*Status:\*\* fenced/)
  await props.getByText("Oct", { exact: false }).first().waitFor() // Started as a formatted date
  console.log("ok  task file: meta lines are rows, the body keeps lower and fenced **Key:** lines")

  // 2. status from the row: file, board, row, buffer
  await page.getByRole("tab", { name: "Split" }).click()
  await page.locator(".cm-content").getByText("**Status:** 📋 Todo").waitFor()
  await page.locator("[data-synced] .cm-content").waitFor() // a change before the room syncs can't reach the buffer
  await props.getByRole("button", { name: "Status of T001" }).click()
  await page.getByRole("menuitem", { name: "In progress" }).click()
  await props.getByRole("button", { name: "Status of T001" }).getByText("In progress").waitFor()
  for (let i = 0; i < 50 && !readFileSync(path.join(fx, T1), "utf8").includes("**Status:** 🔨 In-progress"); i++) await new Promise((r) => setTimeout(r, 100))
  assert.match(readFileSync(path.join(fx, T1), "utf8"), /\*\*Status:\*\* 🔨 In-progress/)
  const tasks = await (await fetch(`${BASE}/api/tasks${q}`)).json()
  assert.equal(tasks.tasks.find((t) => t.id === "T001").status, "in-progress")
  await page.locator(".cm-content").getByText("**Status:** 🔨 In-progress").waitFor()
  console.log("ok  Status from the row: file line, board and row change; the open buffer gets the new line")

  await page.route("**/api/tasks?**", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: "boom" } }) : route.fallback())
  await props.getByRole("button", { name: "Status of T001" }).click()
  await page.getByRole("menuitem", { name: "Done" }).click()
  await page.getByText("Could not move T001: boom").waitFor()
  await props.getByRole("button", { name: "Status of T001" }).getByText("In progress").waitFor()
  assert.match(readFileSync(path.join(fx, T1), "utf8"), /\*\*Status:\*\* 🔨 In-progress/)
  await page.unroute("**/api/tasks?**")
  console.log("ok  a failed move rolls back with the toast")

  // 3. chips
  await page.getByRole("tab", { name: "Preview" }).click()
  await props.getByRole("link", { name: "R002" }).click()
  await page.waitForURL((u) => u.pathname === "/roadmap" && u.searchParams.get("item") === "R002")
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent(T1)}`)
  await props.getByRole("link", { name: "T002" }).click()
  await page.waitForURL((u) => u.pathname === "/board" && u.searchParams.get("task") === "T002")
  console.log("ok  Phase chip opens the epic, Depends on chip opens the task")

  // 4. epic file
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("plans/roadmap/R002-epic.md")}`)
  await body.getByText("Epic body.").waitFor()
  const e = await labels()
  for (const k of ["Parent", "Status", "Order", "Tasks"]) assert.ok(e.includes(k), `epic row ${k} in ${e}`)
  assert.equal(await props.getByRole("link", { name: "T001" }).count(), 1)
  assert.ok(!/Order:/.test(await body.innerText()))
  console.log("ok  epic file: Parent, Status, Order, Tasks are rows")

  // 5. plain doc unchanged
  await page.goto(`${BASE}/docs?doc=docs%2Fplain.md`)
  await body.getByText("Some text.").waitFor()
  assert.deepEqual((await labels()).filter((k) => !["Last edited", "Length"].includes(k)), [])
  assert.match(await body.innerText(), /Key: not a property/)
  assert.equal(readFileSync(path.join(fx, "docs/plain.md"), "utf8"), plain)
  console.log("ok  a doc without a meta block renders as before")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
