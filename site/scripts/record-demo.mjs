// Draft (T204 finishes it): a ~15 s clip of an agent claiming a task and finishing it while the board is open.
// Uses a temp fixture project and the VibeDoc dev server on :3000, light theme. Writes <out>/demo.webm.
//   PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0 node site/scripts/record-demo.mjs site/public
// T204 adds the MP4 (ffmpeg) and a poster frame; the fixture's folder name still shows in the breadcrumb.
import { createRequire } from "node:module"
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
const req = createRequire(process.env.PW_DIR + "/noop.js")
const { chromium } = req("playwright")
const OUT = process.argv[2]
const BASE = "http://localhost:3000"
const fx = mkdtempSync(path.join(tmpdir(), "vibedoc-clip-"))
mkdirSync(path.join(fx, "plans/roadmap"), { recursive: true })
mkdirSync(path.join(fx, "plans/tasks"), { recursive: true })
writeFileSync(path.join(fx, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** in-progress\n**Order:** 10\n**Tasks:** —\n")
writeFileSync(path.join(fx, "plans/roadmap/R002-billing.md"), "# R002: Self-serve billing\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001, T002, T003, T004\n\nPay without talking to sales.\n")
const task = (id, title, status, deps = "—") => writeFileSync(path.join(fx, `plans/tasks/${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`),
  `# ${id}: ${title}\n**Status:** ${status}\n**Phase:** R002 — Self-serve billing\n**Size:** M (2–3 hrs)\n**Depends on:** ${deps}\n\n## Goal\n${title}.\n`)
task("T001", "Plan catalog", "✅ Done")
task("T002", "Checkout happy path", "📋 Todo", "T001")
task("T003", "Receipts by email", "📋 Todo", "T002")
task("T004", "Cancel a subscription", "📋 Todo", "T002")
const mcp = (name, args) => fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) })
const b = await chromium.launch({ channel: "chrome" })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: "light", recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } })
const p = await ctx.newPage()
await p.route("**/api/projects", (r) => r.fulfill({ json: [{ id: "acme", name: "acme-app", root: fx, hasVibedoc: true }] }))
const light = () => p.evaluate(() => { document.documentElement.classList.remove("dark"); document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()) })
await p.goto(`${BASE}/board`)
await p.getByText("Checkout happy path").first().waitFor()
await light()
await p.waitForTimeout(2200)
await mcp("vibedoc_next_task", { epic: "R002", agent: "claude-code" })
await p.waitForTimeout(800); await light(); await p.waitForTimeout(2600)
await mcp("vibedoc_update_task", { taskId: "T002", status: "done", agent: "claude-code", manualTests: "### Steps\n- [x] Pick Monthly → the checkout opens\n- [x] Pay with a test card → receipt shows" })
await p.waitForTimeout(800); await light(); await p.waitForTimeout(2600)
await mcp("vibedoc_next_task", { epic: "R002", agent: "claude-code" })
await p.waitForTimeout(800); await light(); await p.waitForTimeout(3000)
const v = p.video()
await ctx.close(); await b.close()
renameSync(await v.path(), path.join(OUT, "demo.webm"))
rmSync(fx, { recursive: true, force: true })
console.log("ok")
