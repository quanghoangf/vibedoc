// Browser + MCP check for R068 (Scenarios as acceptance tests), end to end on a fixture project. The epic's Done-when:
// breaking down an epic with three scenarios yields tasks whose checklists cover all three, and the epic shows each
// scenario as passed, failed or unproven.
//   1. Epic R002 with S1–S3 → accept a breakdown plan (one task per scenario) → each task has **Covers:** and a seeded
//      "Sn — WHEN … → THEN …" step; a plan with an unknown id is refused.
//   2. Tick S1's step by hand; give S2's task a failed auto run that left its 🤖 step unticked; leave S3.
//   3. The epic sheet shows S1 passed, S2 failed, S3 unproven (S2 links to its evidence); vibedoc_get_roadmap says
//      "scenarios 1/3 passed" and the roadmap has no uncovered-scenario drift.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/scenarios.mjs
//
// Uses the real /api/mcp and routes (only /api/projects and /api/chat are stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), [
  "# R002: Epic", "**Parent:** R001", "**Status:** planned", "**Order:** 10", "**Tasks:** —", "",
  "Checkout.", "", "## Scenarios",
  "### S1: Buy a plan", "- WHEN the user picks Monthly", "- THEN they see a receipt", "",
  "### S2: Unknown plan", "- WHEN the plan id is unknown", "- THEN they see an error", "",
  "### S3: Cancel", "- WHEN the user cancels", "- THEN billing stops", "",
].join("\n"))
const taskFile = (id) => path.join(fx, "plans/tasks", readdirSync(path.join(fx, "plans/tasks")).find((f) => f.startsWith(`${id}-`)))

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

const browser = await launchChrome()
const errors = []
try {
  // 1. Breakdown: unknown id refused; three tasks, each covering one scenario, seeded
  const tasks = ["S1", "S2", "S3"].map((s, i) => ({ key: `t${i + 1}`, title: `Task for ${s}`, body: "## Goal\nx", covers: [s] }))
  assert.match(await mcp("vibedoc_propose_plan", { plan: { kind: "breakdown", epic: "R002", tasks: [{ ...tasks[0], covers: ["S9"] }] } }),
    /covers "S9" is not a scenario of R002 \(valid: S1, S2, S3\)/)
  const applied = await (await post("/api/plan/apply", { plan: { kind: "breakdown", epic: "R002", tasks }, selected: ["t1", "t2", "t3"] })).json()
  const ids = applied.created.map((c) => c.id)
  assert.equal(ids.length, 3)
  ids.forEach((id, i) => {
    const raw = readFileSync(taskFile(id), "utf8")
    assert.match(raw, new RegExp(`^\\*\\*Covers:\\*\\* S${i + 1}$`, "m"))
    assert.match(raw, new RegExp(`^- \\[ \\] S${i + 1} — WHEN .+ → THEN .+$`, "m"))
  })
  console.log("ok  breakdown: unknown id refused; 3 tasks with Covers and a seeded step each")

  // 2. S1 ticked by a person; S2's auto run failed and left its 🤖 step unticked; S3 untouched
  assert.equal((await post("/api/tasks/manual-tests", { id: ids[0], index: 0, checked: true })).status, 200)
  const t2 = taskFile(ids[1])
  writeFileSync(t2, readFileSync(t2, "utf8")
    .replace(/^_(\d{4}-\d{2}-\d{2}) — (\w+)_$/m, "_$1 — $2 · Spec: `e2e/vibedoc/x.spec.ts` · Auto: failed $1_")
    .replace(/^- \[ \] S2 — /m, "- [ ] 🤖 S2 — "))

  // 3. The epic sheet and the roadmap tool agree
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    // the app has no favicon; not this feature's concern
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/roadmap?item=R002`)
  const scenarios = page.getByRole("region", { name: "Scenarios" })
  const proof = (s) => scenarios.getByRole("listitem", { name: new RegExp(`^${s} `) })
  await proof("S1").getByText("passed", { exact: true }).waitFor()
  await proof("S2").getByText("failed", { exact: true }).waitFor()
  await proof("S3").getByText("unproven", { exact: true }).waitFor()
  assert.equal(await proof("S2").getByRole("link", { name: "failed" }).getAttribute("href"), `/manual-tests?tab=all&task=${ids[1]}&view=evidence`)
  const roadmap = await mcp("vibedoc_get_roadmap", {})
  assert.match(roadmap, /\*\*R002\*\* Epic .* · scenarios 1\/3 passed/)
  assert.doesNotMatch(roadmap, /not covered by any task/)
  console.log("ok  sheet: S1 passed, S2 failed (links to evidence), S3 unproven; get_roadmap: scenarios 1/3 passed")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
