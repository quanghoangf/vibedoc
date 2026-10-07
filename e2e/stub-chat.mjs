// Browser check for the chat PlanCard (T040), plus the reusable stubChat() helper.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/stub-chat.mjs
//
// Playwright isn't a repo dependency: install it anywhere (`npm i playwright` in a temp dir) and point
// PW_DIR there. Uses the system Chrome. Needs the dev server on BASE (default http://localhost:3000).
// Writes only into a fresh mktemp fixture project, never this repo.
import { createRequire } from "node:module"
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

/**
 * Stub the chat backend for `page`:
 * - `/api/projects` returns only `root`, so the UI (and /api/plan/apply) targets the fixture.
 * - `/api/chat` answers with NDJSON stream-json lines. `events` is an array, or `(call, body) => array`
 *   for per-message answers (call counts from 0).
 * Returns `calls`: the parsed bodies of every /api/chat POST, to check the notes sent to the agent.
 */
export async function stubChat(page, events, { root } = {}) {
  const calls = []
  if (root) {
    await page.route("**/api/projects", (route) =>
      route.fulfill({ json: [{ id: "fixture", name: "fixture", root, hasVibedoc: true }] }))
  }
  await page.route("**/api/chat**", (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}")
    const lines = typeof events === "function" ? events(calls.length, body) : events
    calls.push(body)
    route.fulfill({ contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" })
  })
  return calls
}

/** A stream-json turn where the agent calls `tool` with `input`. */
export function toolTurn(id, tool, input, text = "") {
  return [
    { type: "assistant", session_id: "s1", message: { content: [{ type: "tool_use", id, name: `mcp__vibedoc__${tool}`, input }] } },
    ...(text ? [{ type: "stream_event", session_id: "s1", event: { type: "content_block_delta", delta: { type: "text_delta", text } } }] : []),
    { type: "result", is_error: false, session_id: "s1" },
  ]
}

/** A fresh fixture project: horizon R001 with epic R002, an empty plans/tasks, first-run feedback declined. */
export function makeFixture() {
  const fx = mkdtempSync(path.join(tmpdir(), "vibedoc-e2e-"))
  mkdirSync(path.join(fx, "plans/roadmap"), { recursive: true })
  mkdirSync(path.join(fx, "plans/tasks"), { recursive: true })
  writeFileSync(path.join(fx, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
  writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
  // R086: answered, so scripts don't meet the first-run feedback card (delete it to see the card)
  mkdirSync(path.join(fx, ".vibedoc"), { recursive: true })
  writeFileSync(path.join(fx, ".vibedoc/feedback.json"), JSON.stringify({ consent: false, sent: [] }))
  return fx
}

export async function launchChrome() {
  const req = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), "noop.js"))
  const { chromium } = req("playwright")
  return chromium.launch({ channel: "chrome" })
}

async function main() {
  const BASE = process.env.BASE ?? "http://localhost:3000"
  const fx = makeFixture()
  const tasksDir = path.join(fx, "plans/tasks")
  const files = () => readdirSync(tasksDir).sort()
  const plan = {
    kind: "breakdown",
    epic: "R002",
    tasks: [
      { key: "t1", title: "Alpha task", size: "S (~1 hr)", body: "## Goal\nAlpha body" },
      { key: "t2", title: "Bravo task", dependsOn: ["t1"], body: "## Goal\nBravo body" },
      { key: "t3", title: "Charlie task", body: "## Goal\nCharlie body" },
    ],
  }

  const browser = await launchChrome()
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    const calls = await stubChat(page, (call) => toolTurn(`tu${call}`, "vibedoc_propose_plan", { plan }, "Here is the plan."), { root: fx })
    await page.goto(`${BASE}/board`)
    await page.waitForLoadState("networkidle")
    await page.keyboard.press("c")

    const box = page.getByPlaceholder(/Ask the agent/)
    await box.fill("break down R002")
    await box.press("Enter")

    // 1. Card with 3 checked rows; nothing written
    const card = page.locator("div:has(> ul > li[data-plan-row])").last()
    await card.locator("li[data-plan-row]").nth(2).waitFor()
    assert.equal(await card.locator('input[type="checkbox"]:checked').count(), 3)
    assert.deepEqual(files(), [])
    console.log("ok  card shows 3 checked rows, no files")

    // Row expands to its body
    await card.getByText("Bravo task").click()
    await card.getByText("Bravo body").waitFor()

    // 2. Unchecking t1 while t2 depends on it: error in the card, nothing written
    await card.getByLabel("Include Alpha task").uncheck()
    await card.getByRole("button", { name: /^Accept/ }).click()
    await card.getByText("t2 depends on t1, which you unchecked").waitFor()
    assert.deepEqual(files(), [])
    console.log("ok  dependency error shown in card, no files")

    // 3. Uncheck t3, Accept: 2 files, ids in card, board updates live
    await card.getByLabel("Include Alpha task").check()
    await card.getByLabel("Include Charlie task").uncheck()
    await card.getByRole("button", { name: "Accept (2)" }).click()
    await card.getByText("✓ Created").waitFor()
    const created = files()
    assert.equal(created.length, 2, `expected 2 task files, got ${created}`)
    const ids = created.map((f) => f.slice(0, 4))
    for (const id of ids) await card.getByRole("button", { name: id }).waitFor()
    await page.getByText("Alpha task", { exact: true }).waitFor({ timeout: 5000 })
    await page.getByText("Bravo task", { exact: true }).waitFor({ timeout: 5000 })
    assert.equal(await page.getByText("Charlie task", { exact: true }).count(), 0)
    console.log(`ok  accepted: created ${created.join(", ")}; board shows them without reload`)

    // 4. Next message carries the accept note; its plan gets rejected; the one after carries the reject note
    await box.fill("another plan please")
    await box.press("Enter")
    await page.getByText("Accept (3)").waitFor()
    assert.match(calls[1].message, new RegExp(`User accepted plan for R002: created ${ids.join(", ")} \\(unchecked: t3\\)\\.`))
    const card2 = page.locator("div:has(> ul > li[data-plan-row])").last()
    await card2.getByRole("button", { name: "Reject" }).click()
    await card2.getByText("Rejected").waitFor()
    await box.fill("ok")
    await box.press("Enter")
    await page.waitForFunction(() => document.querySelectorAll("li[data-plan-row]").length === 9)
    assert.match(calls[2].message, /User rejected the plan for R002\./)
    assert.equal(files().length, 2)
    console.log("ok  reject marks the card and the next message includes the note")
    console.log(`fixture: ${fx}`)
  } finally {
    await browser.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
