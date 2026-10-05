// Browser + MCP check for R067 (Spec verification review), end to end on a fixture git repo. The epic's Done-when:
// a task finished with one acceptance criterion skipped gets a finding naming that criterion, and sending it back
// leads the agent to fix it. The test plays the reviewing agent by calling the MCP tools.
//   1. T001 (two acceptance criteria, one commit "(T001)") → vibedoc_verify_context has both criteria and the diff.
//   2. vibedoc_report_findings: a critical finding on AC2 → the panel shows it, the card badge says 1 finding.
//   3. Send back from the panel → vibedoc_next_task starts with "Changes requested" and the finding.
//   4. A new commit "(T001)" → the report shows as outdated in the panel and in vibedoc_get_task.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/verification.mjs
//
// Uses the real /api/mcp and routes (only /api/projects and /api/chat are stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const git = (...args) => execFileSync("git", ["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", ...args], { cwd: fx, encoding: "utf8" })

writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"),
  "# R002: Epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001\n\nCheckout.\n\n**Done when:** a plan can be bought\n")
writeFileSync(path.join(fx, "plans/tasks/T001-checkout.md"), [
  "# T001: Checkout route", "**Status:** 👀 Review", "**Phase:** R002 — Epic", "",
  "## Goal", "Buy a plan.", "",
  "## Acceptance criteria", '- [ ] AC1 "Known plan → 200"', '- [ ] AC2 "Unknown plan → 400"', "",
].join("\n"))
mkdirSync(path.join(fx, "src"), { recursive: true })
writeFileSync(path.join(fx, "src/checkout.js"), "export function checkout(plan) {\n  return { status: 200, plan }\n}\n")
git("init", "-q")
git("add", "-A")
git("commit", "-q", "-m", "feat(checkout): checkout route (T001)")

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
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    // the app has no favicon; not this feature's concern
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. The context names both criteria and carries the commit's diff
  const ctx = await mcp("vibedoc_verify_context", { taskId: "T001" })
  assert.match(ctx, /AC1 "Known plan → 200"/)
  assert.match(ctx, /AC2 "Unknown plan → 400"/)
  assert.match(ctx, /## Epic Done when\na plan can be bought/)
  assert.match(ctx, /feat\(checkout\): checkout route \(T001\)/)
  assert.match(ctx, /\+  return \{ status: 200, plan \}/)
  const sha = git("rev-parse", "--short", "HEAD").trim()
  assert.ok(ctx.includes(`sha: "${sha}"`))
  console.log("ok  vibedoc_verify_context has both criteria and the commit diff")

  // 2. The agent reports the skipped criterion; the panel and the card show it
  assert.match(await mcp("vibedoc_report_findings", { taskId: "T001", sha, findings: [
    { severity: "critical", criterion: 'AC2 "Unknown plan → 400"', message: "unknown plans return 200", file: "src/checkout.js:2" },
  ] }), /1 critical/)
  await page.goto(`${BASE}/board`)
  const card = page.getByRole("button", { name: /^T001 / })
  await card.getByText("1 finding").waitFor()
  await card.click()
  const verification = page.getByRole("dialog").getByRole("region", { name: "Verification" })
  await verification.getByText('AC2 "Unknown plan → 400"').waitFor()
  await verification.getByText("critical · 1").waitFor()
  console.log("ok  findings show in the panel; the card badge says 1 finding")

  // 3. Send back → the agent's next claim starts with the finding
  await verification.getByRole("button", { name: "Send back 1 finding" }).click()
  await page.getByRole("dialog").waitFor({ state: "detached" })
  const claim = await mcp("vibedoc_next_task", { epic: "R002", agent: "e2e" })
  assert.match(claim, /^🔨 Claimed \*\*T001\*\*/)
  assert.match(claim, /⚠️ Changes requested[^\n]*:\nFix this verification finding:\n- \[critical\] AC2 "Unknown plan → 400" — unknown plans return 200/)
  console.log("ok  send back → vibedoc_next_task starts with the finding")

  // 4. A new commit for the task makes the report outdated
  writeFileSync(path.join(fx, "src/checkout.js"), "export function checkout(plan) {\n  return plan ? { status: 200, plan } : { status: 400 }\n}\n")
  git("commit", "-qam", "fix(checkout): 400 on unknown plans (T001)")
  assert.match(await mcp("vibedoc_get_task", { taskId: "T001" }), /Verification findings above are outdated/)
  await page.goto(`${BASE}/board?task=T001`)
  await verification.getByText("outdated — re-verify").waitFor()
  assert.equal(await verification.getByRole("checkbox").count(), 0)
  console.log("ok  a newer (T001) commit → findings outdated in the panel and vibedoc_get_task")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
