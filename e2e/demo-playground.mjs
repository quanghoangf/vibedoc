// End-to-end check for `vibedoc --demo` (R085): the demo touches nothing outside its temporary copy (S2).
//   1. Starts `node bin/vibedoc.mjs --demo --port $PORT --no-open` itself (needs a prior `pnpm build`).
//   2. Moves a task, edits a doc and ticks a manual test through the API: the changes land in the temp copy.
//   3. Agent chat and test runs are refused (403); the chat page shows "doesn't run agents" instead of a composer.
//   4. Ctrl+C (SIGINT): the server stops, the temp folder is gone, `examples/` is unchanged and `~/.vibedoc/runs` has the same entries.
//
//   pnpm build && PW_DIR=<dir with node_modules/playwright> node e2e/demo-playground.mjs
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { launchChrome } from "./stub-chat.mjs"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PORT = process.env.PORT ?? "3085"
const BASE = `http://localhost:${PORT}`
const runsRoot = process.env.VIBEDOC_RUNS_DIR || path.join(homedir(), ".vibedoc", "runs")
const listRuns = () => (existsSync(runsRoot) ? readdirSync(runsRoot).sort() : [])

const runsBefore = listRuns()
const cli = spawn(process.execPath, [path.join(repo, "bin/vibedoc.mjs"), "--demo", "--port", PORT, "--no-open"], { stdio: ["ignore", "pipe", "inherit"] })
const exited = new Promise((resolve) => cli.on("exit", resolve))
let browser
let tmp

async function api(url, init) {
  const res = await fetch(BASE + url, init && { method: "POST", headers: { "Content-Type": "application/json" }, ...init, body: JSON.stringify(init.body) })
  return { status: res.status, json: await res.json().catch(() => null) }
}

try {
  for (let i = 0; ; i++) {
    if (await fetch(`${BASE}/api/summary`).then((r) => r.ok, () => false)) break
    assert.ok(i < 60, "the demo answers within 30s")
    await new Promise((r) => setTimeout(r, 500))
  }
  const { json: summary } = await api("/api/summary")
  assert.equal(summary.playground, true)
  assert.equal(summary.name, "listly")
  const root = summary.root
  tmp = path.dirname(root)
  assert.ok(!root.startsWith(repo), "the demo runs on a copy, not on examples/")

  // 2. Changes land in the copy
  assert.equal((await api("/api/tasks", { body: { taskId: "T008", status: "in-progress" } })).status, 200)
  const t008 = readdirSync(path.join(root, "plans/tasks")).find((f) => f.startsWith("T008"))
  assert.match(readFileSync(path.join(root, "plans/tasks", t008), "utf8"), /\*\*Status:\*\* 🔨 In-progress/)
  assert.equal((await api("/api/docs", { method: "PUT", body: { path: "docs/api/lists.md", content: "# Lists API\n\nEdited in the demo.\n" } })).status, 200)
  assert.match(readFileSync(path.join(root, "docs/api/lists.md"), "utf8"), /Edited in the demo/)
  assert.equal((await api("/api/tasks/manual-tests", { body: { ids: ["T006"], checked: true } })).status, 200)
  // ?root= can't reach outside the copy
  const { json: other } = await api(`/api/tasks?root=${encodeURIComponent(repo)}`)
  assert.ok(other.tasks.every((t) => !t.title.includes("Demo playground")), "?root= is ignored in the demo")

  // 3. No agents, no test runs
  assert.equal((await api("/api/chat", { body: { message: "hi" } })).status, 403)
  assert.equal((await api("/api/tasks/run", { body: { id: "T004" } })).status, 403)
  assert.equal((await api("/api/suite/run", { body: {} })).status, 403)
  browser = await launchChrome()
  const page = await browser.newPage()
  await page.goto(`${BASE}/chat`)
  await page.getByRole("heading", { name: "Run chats side by side" }).waitFor()
  await page.keyboard.press("c") // a new chat (none are saved yet)
  await page.getByText("The demo doesn't run agents.").first().waitFor()
  assert.equal(await page.locator("textarea").count(), 0, "no chat composer in the demo")

  // 4. Quit like Ctrl+C
  cli.kill("SIGINT")
  await exited
  assert.ok(!existsSync(tmp), `the temp folder ${tmp} is removed`)
  for (let i = 0; await fetch(`${BASE}/api/summary`).then(() => true, () => false); i++) {
    assert.ok(i < 20, "the server stops with the CLI (no next-server left behind)")
    await new Promise((r) => setTimeout(r, 250))
  }
  assert.equal(execFileSync("git", ["status", "--porcelain", "examples/"], { cwd: repo, encoding: "utf8" }), "", "examples/ is unchanged")
  assert.deepEqual(listRuns(), runsBefore, "~/.vibedoc/runs is untouched")
  console.log("demo-playground: ok")
} finally {
  await browser?.close()
  if (cli.exitCode === null) { cli.kill("SIGINT"); await exited }
}
