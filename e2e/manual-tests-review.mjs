// Browser check for R043 (manual tests & optional review), end to end on a fixture project:
//   1. An agent finishes tasks with reports (vibedoc_update_task + manualTests) → card badges → tick everything
//      on /manual-tests → the task files get - [x] and the badges turn green.
//   2. Review: move a task to review → send it back from the panel → vibedoc_next_task reclaims it with the
//      note first → back to review → approve → done, with both entries in ## Review.
//   3. No gate: a task without a report moves straight to done.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/manual-tests-review.mjs
//
// Uses the real /api/mcp and routes (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002, T003\n")
writeFileSync(path.join(fx, "plans/tasks/T001-first.md"), "# T001: First\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n**Depends on:** —\n")
writeFileSync(path.join(fx, "plans/tasks/T002-second.md"), "# T002: Second\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n**Depends on:** T001\n")
writeFileSync(path.join(fx, "plans/tasks/T003-third.md"), "# T003: Third\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n**Depends on:** —\n")
const file = (id) => readFileSync(path.join(fx, "plans/tasks", { T001: "T001-first.md", T002: "T002-second.md", T003: "T003-third.md" }[id]), "utf8")

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. The /work-epic loop, as the agent does it: claim, then done with a report
  for (const id of ["T001", "T002"]) {
    assert.match(await mcp("vibedoc_next_task", { epic: "R002" }), new RegExp(`Claimed \\*\\*${id}\\*\\*`))
    const out = await mcp("vibedoc_update_task", { taskId: id, status: "done", manualTests: `### Steps\n- [ ] Open ${id} → it works\n### Regression risk\n- [ ] Board still loads` })
    assert.match(out, /🧪 Manual tests: 0\/2 ticked/)
  }
  await page.goto(`${BASE}/board`)
  await page.getByTitle("Manual tests: 0 of 2 ticked").nth(1).waitFor()
  await page.goto(`${BASE}/manual-tests`)
  await page.getByText("4 items to check across 2 tasks").waitFor()
  for (const label of ["Open T001 → it works", "Open T002 → it works"]) await page.getByLabel(label).check()
  for (const box of await page.getByLabel("Board still loads").all()) await box.check()
  await page.getByText("Nothing left to check.").waitFor()
  for (let i = 0; i < 30 && !(file("T001").includes("- [x] Board still loads") && file("T002").includes("- [x] Board still loads")); i++) await page.waitForTimeout(100)
  for (const id of ["T001", "T002"]) assert.doesNotMatch(file(id), /- \[ \]/, `${id}: every item ticked in the file`)
  await page.goto(`${BASE}/board`)
  await page.getByTitle("Manual tests: 2 of 2 ticked").nth(1).waitFor()
  console.log("ok  agent reports → badges → ticked on /manual-tests → files updated, badges 2/2")

  // 2. Review: send back from the panel → reclaimed with the note first → review again → approve
  await mcp("vibedoc_update_task", { taskId: "T003", status: "review" })
  await page.goto(`${BASE}/board?task=T003`)
  const panel = page.getByRole("dialog")
  await panel.getByRole("button", { name: "Send back…" }).click()
  assert.equal(await panel.getByRole("button", { name: "Send back", exact: true }).isDisabled(), true)
  await panel.getByLabel("Send back note").fill("Title is cut off on mobile")
  await panel.getByRole("button", { name: "Send back", exact: true }).click()
  await page.getByText("changes requested", { exact: true }).first().waitFor()
  const reclaimed = await mcp("vibedoc_next_task", { epic: "R002" })
  assert.match(reclaimed, /Claimed \*\*T003\*\*[^\n]*\n\n⚠️ Changes requested \([^)]+\):\nTitle is cut off on mobile/)
  await mcp("vibedoc_update_task", { taskId: "T003", status: "review" })
  await page.goto(`${BASE}/board?task=T003`)
  await panel.getByText("Changes requested", { exact: true }).waitFor()   // review history
  await panel.getByRole("button", { name: "Approve" }).click()
  await panel.waitFor({ state: "hidden" })
  for (let i = 0; i < 30 && !file("T003").includes("✅ Done"); i++) await page.waitForTimeout(100)
  assert.match(file("T003"), /\*\*Status:\*\* ✅ Done/)
  assert.match(file("T003"), /## Review\n### \S+ — changes requested\nTitle is cut off on mobile\n### \S+ — approved/)
  console.log("ok  review: send back → reclaimed with the note first → approve → done, both in ## Review")

  // 3. No gate: a task without a report goes straight to done (reset T003 to show it)
  await mcp("vibedoc_update_task", { taskId: "T003", status: "todo" })
  await page.goto(`${BASE}/board`)
  const card = page.locator("[draggable=true]", { hasText: "Third" })
  await card.dragTo(page.locator('[data-column="done"]'))
  for (let i = 0; i < 30 && !file("T003").includes("✅ Done"); i++) await page.waitForTimeout(100)
  assert.match(file("T003"), /\*\*Status:\*\* ✅ Done/)
  console.log("ok  no gate: a task drags straight to Done")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
