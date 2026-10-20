// Done-when check for R108 (T565): "the user clicks Work with agent on an epic with ready tasks, accepts the run card,
// closes the tab, and later finds the tasks done and verified on the board and a branch with one commit per task ready to
// review, while their own checkout has no code changes."
//   1. Browser: /roadmap?item=R002 → Work with agent → run card (new worktree on vibedoc/R002, nothing created yet) →
//      Start worker → the worker chat shows T001 → close the page while the worker runs.
//   2. With no page open: the worker ends "Epic finished" with a task turn and a clean review (R067) per task.
//   3. A new page: /board has T001 and T002 in Done, the worker chat shows Ended; both task files say "Verified: nothing
//      found"; vibedoc/R002 has exactly one commit per task; the main checkout's `git status` has no code change.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/agent-runs.mjs
// Writes only a fresh mktemp fixture and its worktree under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
const fx = makeFixture()
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const taskFile = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8")
const status = (id) => taskFile(id).match(/\*\*Status:\*\* (.+)/)[1].toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-")
const chats = () => readdirSync(path.join(fx, ".vibedoc/chats")).map((f) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", f), "utf8")))
const worktrees = () => git(["worktree", "list", "--porcelain"]).split("\n").filter((l) => l.startsWith("worktree ")).length
async function until(fn, what, ms = 45000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

// Fixture: R002 with two ready tasks; reviews are on (the default), the stub finds nothing
const task = (id) => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** R002\n\n## Goal\nWrite ${id}.txt\n`)
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002\n")
task("T001"); task("T002")
writeFileSync(path.join(fx, ".gitignore"), ".claude-stub*.json\n.claude-stub.log\n.claude-stub-verify-*\n")
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)

let dir = null
const browser = await launchChrome()
const errors = []
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
  const open = async (url) => {
    const p = await ctx.newPage()
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
    p.on("pageerror", (e) => errors.push(e.message))
    await p.goto(`${BASE}${url}`)
    return p
  }

  // 1. Work with agent → run card → Start → close the tab
  const trees = worktrees()
  const page = await open("/roadmap?item=R002")
  await page.getByRole("button", { name: "Work with agent" }).click()
  const card = page.getByRole("form", { name: "Work on R002 with an agent" })
  await card.getByText("New worktree").waitFor()
  assert.equal(await card.getByLabel("Branch").inputValue(), "vibedoc/R002")
  await card.getByText(/\d+ allowed · 2 always denied/).click()
  await card.getByText("Bash(git push*)").waitFor()
  assert.equal(worktrees(), trees, "the run card creates nothing")
  assert.equal(git(["branch", "--list", "vibedoc/R002"]).trim(), "")
  await card.getByRole("button", { name: "Start worker" }).click()
  // Start lands on the worker's chat page, not a modal over the roadmap
  await page.waitForURL(/\/chat\?id=/)
  await page.locator("[data-worker-strip]").getByText("Working on T001").waitFor({ timeout: 30000 })
  const worker = chats().find((c) => c.worker?.target.id === "R002")
  dir = worker.worker.dir
  assert.notEqual(worker.worker.phase, "ended", "the worker still runs when the tab closes")
  await page.close()
  console.log("ok  Work with agent → run card (nothing created) → Start worker → T001 running → tab closed (S8, S1)")

  // 2. no page open: the server drives the worker to the end
  const saved = () => chats().find((c) => c.id === worker.id)
  await until(() => saved().worker.phase === "ended", "the worker ended with no page open", 60000)
  assert.equal(saved().worker.reason, "Epic finished")
  assert.deepEqual(saved().worker.turns.map((t) => [t.taskId, t.kind ?? "task", t.result]),
    [["T001", "task", "done"], ["T001", "verify", "clean"], ["T002", "task", "done"], ["T002", "verify", "clean"]])
  console.log("ok  with the tab closed the worker did T001 and T002, each reviewed clean before the next (S2, S11)")

  // 3. later: the board, the files, the branch and the user's checkout
  const later = await open("/board")
  const done = later.locator('[data-column="done"]')
  await done.getByText("T001", { exact: true }).waitFor()
  await done.getByText("T002", { exact: true }).waitFor()
  for (const id of ["T001", "T002"]) {
    assert.equal(status(id), "done")
    assert.match(taskFile(id), /## Verification[\s\S]*Verified: nothing found/)
  }
  console.log("ok  reopened: the board shows T001 and T002 done, both verified with nothing found")

  assert.deepEqual(git(["log", "--format=%s", "main..vibedoc/R002"]).trim().split("\n"), ["feat: T002", "feat: T001"])
  assert.equal(git(["log", "--format=%s", "main"]).trim(), "init", "main has no worker commit")
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => l.slice(3))
  assert.ok(changed.every((f) => /^(plans\/|\.vibedoc)/.test(f)), `main checkout code changes: ${changed}`)
  const chat = await open(`/chat?id=${worker.id}`)
  await chat.getByRole("region", { name: /Worker R002/ }).locator("[data-worker-strip]").getByText("Ended").waitFor()
  console.log("ok  vibedoc/R002 has one commit per task, main has none and no code change; the worker chat shows Ended (S1)")
  assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
} finally {
  await browser.close()
  if (dir) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
