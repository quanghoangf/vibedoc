// Browser check for R086 (first-run feedback) on fresh, empty fixture projects:
//   1. A new project shows the consent card, which lists exactly the requests that would be made (S1).
//   2. No thanks → the card is gone (also after a reload) and nothing goes to GoatCounter while an agent connects,
//      an epic lands on the roadmap and a task is done (S3).
//   3. Yes on a second project → `started` is sent once, then agent connected / first roadmap / first task done are
//      each sent once, in order, as they happen; the requests carry the step and nothing from the project (S2).
// GoatCounter is intercepted (never reached). Fails on any browser console error. Fixtures removed in `finally`.
//
//   BASE=http://localhost:3086 PW_DIR=node_modules/@playwright/test node e2e/first-run-feedback.mjs
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const STEPS = ["started", "agent-connected", "first-roadmap", "first-task-done"]

/** An empty project: no epic, no task, no activity, never asked. */
function emptyFixture() {
  const fx = mkdtempSync(path.join(tmpdir(), "vibedoc-e2e-firstrun-"))
  mkdirSync(path.join(fx, "plans/roadmap"), { recursive: true })
  mkdirSync(path.join(fx, "plans/tasks"), { recursive: true })
  writeFileSync(path.join(fx, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
  return fx
}

const api = (fx, p) => `${BASE}${p}${p.includes("?") ? "&" : "?"}root=${encodeURIComponent(fx)}`
const post = (fx, p, body) => fetch(api(fx, p), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

/** Walks the project through the three later steps, the way an agent and a user would (each one emits SSE). */
async function reachSteps(fx, hits, expectAfter) {
  const r = await post(fx, "/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_memory", arguments: {} } })
  assert.equal(r.status, 200)
  await expectAfter(1)
  assert.equal((await post(fx, "/api/roadmap/create", { title: "First epic", parent: "R001" })).status, 201)
  await expectAfter(2)
  writeFileSync(path.join(fx, "plans/tasks/T001-first.md"), "# T001: First\n**Status:** 📋 Todo\n\n## Goal\nOne.\n")
  assert.equal((await post(fx, "/api/tasks", { taskId: "T001", status: "done" })).status, 200)
  await expectAfter(3)
  return hits
}

async function openProject(browser, fx) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  const hits = []
  await page.route(/goatcounter\.com/, (route) => { hits.push(route.request().url()); return route.fulfill({ status: 204 }) })
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/board`)
  return { page, hits, errors }
}

const until = async (fn, what) => {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out waiting for ${what}`)
}

const fxNo = emptyFixture()
const fxYes = emptyFixture()
const browser = await launchChrome()
try {
  // ── S1 + S3: the card, then No thanks ─────────────────────────────────────────
  {
    const { page, hits, errors } = await openProject(browser, fxNo)
    const card = page.getByRole("region", { name: "First-run feedback" })
    await card.waitFor()
    await card.getByText("What exactly is sent?").click()
    for (const s of STEPS) {
      await card.getByText(`GET https://vibedoc.goatcounter.com/count?p=${encodeURIComponent(`/first-run/${s}`)}`, { exact: false }).waitFor()
    }
    await card.getByRole("button", { name: "No thanks" }).click()
    await card.waitFor({ state: "detached" })
    await page.reload()
    await page.getByRole("heading", { name: /Board/ }).first().waitFor().catch(() => {})
    await page.waitForLoadState("networkidle")
    assert.equal(await card.count(), 0, "the card doesn't come back once answered")
    // Steps happen, nothing leaves
    await reachSteps(fxNo, hits, async () => { await new Promise((r) => setTimeout(r, 600)) })
    await page.reload()
    await page.waitForLoadState("networkidle")
    assert.deepEqual(hits, [], "opted out: no request to GoatCounter")
    assert.deepEqual(errors, [])
    await page.close()
  }

  // ── S2: Yes, then each step once, in order ────────────────────────────────────
  {
    const { page, hits, errors } = await openProject(browser, fxYes)
    const card = page.getByRole("region", { name: "First-run feedback" })
    await card.getByRole("button", { name: "Yes, send these" }).click()
    await card.waitFor({ state: "detached" })
    await until(() => hits.length === 1, "started")
    await reachSteps(fxYes, hits, (n) => until(() => hits.length === n + 1, STEPS[n]))
    // Reloads and later events send nothing again
    await page.reload()
    await page.waitForLoadState("networkidle")
    await post(fxYes, "/api/tasks", { taskId: "T001", status: "todo" })
    await post(fxYes, "/api/tasks", { taskId: "T001", status: "done" })
    await new Promise((r) => setTimeout(r, 800))
    const paths = hits.map((u) => new URL(u).searchParams.get("p"))
    assert.deepEqual(paths, STEPS.map((s) => `/first-run/${s}`), "each step once, in order")
    for (const u of hits) {
      assert.ok(!u.includes(path.basename(fxYes)) && !u.includes(encodeURIComponent(fxYes)), "no project path in the request")
      assert.deepEqual([...new URL(u).searchParams.keys()], ["p", "t", "e"])
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log("first-run-feedback: ok")
} finally {
  await browser.close()
  rmSync(fxNo, { recursive: true, force: true })
  rmSync(fxYes, { recursive: true, force: true })
}
