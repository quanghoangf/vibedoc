// Check for R108 T563: when a worker's run ends, the user reviews its branch and can remove the worktree (S6).
//   1. R002 (T001) runs to the end → GET /api/workers/diff lists the stub's commit "feat: T001" and T001.txt (+1).
//   2. POST /api/workers/remove on the dirty worktree (the stub leaves .claude-stub.log untracked) → 409 dirty, folder kept.
//   3. Browser: /chat?id= shows the finish panel (commit + file) → Remove worktree → Remove → the dialog asks to discard →
//      tick "Also delete branch", Discard and remove → "Worktree removed" in the strip. No console errors.
//   4. The folder is gone, `git worktree list` no longer has it, the branch is deleted, the chat is kept with removedAt;
//      the main checkout keeps its branch, HEAD and files. A second remove → 409.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/worker-finish.mjs
// Writes only a fresh mktemp fixture and its worktree under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
async function until(fn, what, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001\n")
writeFileSync(path.join(fx, "plans/tasks/T001-task.md"), "# T001: Task T001\n**Status:** todo\n**Phase:** R002\n\n## Goal\nWrite T001.txt\n")
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ workers: { verify: false } }))
writeFileSync(path.join(fx, "README.md"), "# Fixture\n")
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)
const mainHead = git(["rev-parse", "HEAD"]).trim()

let dir = null
try {
  // 1. the run ends; its diff
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dir = w.dir
  await until(() => savedChat(w.id).worker.phase === "ended", "worker ended")
  const diff = await (await fetch(`${BASE}/api/workers/diff${q}&id=${w.id}`)).json()
  assert.deepEqual(diff.commits.map((c) => c.subject), ["feat: T001"])
  assert.deepEqual(diff.files.map((f) => [f.path, f.added, f.removed]), [["T001.txt", 1, 0]])
  assert.match(diff.files[0].patch, /^\+T001 was here$/m)
  assert.equal(diff.cut, 0)
  console.log("ok  GET /api/workers/diff → the stub's commit and T001.txt (S6)")

  // 2. dirty → asks first
  const dirty = await post("/api/workers/remove", { id: w.id })
  assert.equal(dirty.status, 409)
  assert.equal((await dirty.json()).dirty, true)
  assert.ok(existsSync(dir), "the folder stays until the user confirms")
  console.log("ok  remove on a dirty worktree → 409 dirty, nothing removed")

  // 3. browser: panel, confirm, discard
  const browser = await launchChrome()
  const errors = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
    const page = await ctx.newPage()
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
    page.on("pageerror", (e) => errors.push(e.message))
    // the first Remove's 409 (dirty) is the expected answer; Chrome logs it as a console error
    const conflicts = []
    page.on("response", (r) => { if (r.status() === 409) conflicts.push(new URL(r.url()).pathname) })
    await page.goto(`${BASE}/chat?id=${w.id}`)
    const panel = page.getByRole("region", { name: "What vibedoc/R002 changed" })
    await panel.getByText("feat: T001").waitFor()
    await panel.getByText("T001.txt").waitFor()
    await panel.getByText("+T001 was here").waitFor()
    await panel.getByRole("button", { name: "Remove worktree" }).click()
    const dialog = page.getByRole("dialog", { name: "Remove the worktree?" })
    await dialog.getByRole("button", { name: "Remove", exact: true }).click()
    await dialog.getByText(/uncommitted changes/).waitFor()
    assert.ok(existsSync(dir), "still there after the first Remove")
    await dialog.getByLabel("Also delete branch vibedoc/R002").check()
    await dialog.getByRole("button", { name: "Discard and remove" }).click()
    await dialog.waitFor({ state: "hidden" })
    await page.locator("[data-worker-strip]").getByText("Worktree removed").waitFor()
    assert.equal(await panel.getByRole("button", { name: "Remove worktree" }).count(), 0, "no Remove once removed")
    assert.deepEqual(conflicts, ["/api/workers/remove"])
    errors.splice(0, errors.length, ...errors.filter((e) => !/status of 409/.test(e)))
    assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
    console.log("ok  the chat's finish panel lists the commit and file; Remove asks to discard, then removes (S6)")
  } finally {
    await browser.close()
  }

  // 4. gone, main untouched
  assert.ok(!existsSync(dir), "the worktree folder is gone")
  assert.ok(!git(["worktree", "list", "--porcelain"]).includes(dir), "git worktree list no longer has it")
  assert.equal(git(["branch", "--list", "vibedoc/R002"]).trim(), "", "the branch is deleted")
  assert.equal(git(["branch", "--show-current"]).trim(), "main")
  assert.equal(git(["rev-parse", "HEAD"]).trim(), mainHead)
  assert.ok(existsSync(path.join(fx, "README.md")) && !existsSync(path.join(fx, "T001.txt")))
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => l.slice(3))
  assert.ok(changed.every((f) => /^(plans\/|\.vibedoc)/.test(f)), `main checkout changes: ${changed}`)
  assert.ok(savedChat(w.id).worker.removedAt, "the chat stays, marked removed")
  assert.equal((await post("/api/workers/remove", { id: w.id })).status, 409)
  dir = null
  console.log("ok  folder and branch gone, chat kept; the main checkout keeps its branch, HEAD and files")
} finally {
  if (dir) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
