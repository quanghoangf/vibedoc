// Check for R108 T563 + T564: when a worker's run ends, the user reviews its branch, opens a PR or merges it, and can
// remove the worktree (S6).
//   1. R002 (T001) runs to the end → GET /api/workers/diff lists the stub's commit "feat: T001" and T001.txt (+1).
//   2. POST /api/workers/remove on the dirty worktree (the stub leaves .claude-stub.log untracked) → 409 dirty, folder kept.
//   3. POST /api/workers/merge refused, main untouched: a dirty src/ file, another branch checked out, a conflict (aborted).
//      POST /api/workers/pr with gh logged out → 409 with the two commands, nothing pushed.
//   4. Browser: /chat?id= shows the finish panel (commit + file) → Open PR → the dialog names both commands → Push and
//      open PR → the PR link shows, the branch is on origin. A plans/tasks file is modified → Merge into main → the dialog
//      names `git merge --no-ff --no-edit vibedoc/R002` → Merge → "Merged into main" and the Remove dialog is offered with
//      "Also delete branch" ticked → Remove → asks to discard → Discard and remove → "Worktree removed". No console errors.
//   5. The folder is gone, `git worktree list` no longer has it, the branch is deleted, the chat is kept with removedAt,
//      prUrl and mergedAt; main is a merge commit on the old HEAD with T001.txt, still on main, the task file's change
//      kept. A second remove → 409.
//
// The server must run with e2e/fixtures/claude-stub and e2e/fixtures/gh-stub first on PATH and the same VIBEDOC_HOME:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PWD/e2e/fixtures/gh-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/worker-finish.mjs
// Writes only a fresh mktemp fixture, a bare origin next to it, and its worktree under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
mkdirSync(path.join(fx, "src"))
writeFileSync(path.join(fx, "src/app.ts"), "export const a = 1\n")
git(["init", "-q", "-b", "main"])
// the server's merge commits as the repo's user
git(["config", "user.name", "e2e"])
git(["config", "user.email", "e2e@example.com"])
git(["add", "-A"])
git(["commit", "-q", "-m", "init"])
const origin = `${fx}-origin.git`
execFileSync("git", ["init", "-q", "--bare", origin])
git(["remote", "add", "origin", origin])
const onOrigin = (b) => execFileSync("git", ["ls-remote", "--heads", origin, b], { encoding: "utf8" }).trim() !== ""
const { id: projectId } = registerProject(fx)
const mainHead = git(["rev-parse", "HEAD"]).trim()

let dir = null
try {
  // 1. the run ends; its diff
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" }, base: "main" })
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

  // 3. merge refusals leave main as it was; PR without a gh login → the commands, nothing pushed
  const status = () => git(["status", "--porcelain"])
  const refusedMerge = async (why) => {
    const before = status()
    const r = await post("/api/workers/merge", { id: w.id })
    const d = await r.json()
    assert.equal(r.status, 409, JSON.stringify(d))
    assert.equal(d.offerPr, true)
    assert.match(d.error, why)
    assert.equal(status(), before, "main's status unchanged")
    assert.throws(() => git(["rev-parse", "-q", "--verify", "MERGE_HEAD"]), "no merge left in progress")
  }
  appendFileSync(path.join(fx, "src/app.ts"), "// mine\n")
  await refusedMerge(/uncommitted changes outside VibeDoc's files: src\/app\.ts/)
  git(["checkout", "--", "src/app.ts"])
  git(["switch", "-q", "-c", "other"])
  await refusedMerge(/on other, not main/)
  git(["switch", "-q", "main"])
  git(["branch", "-q", "-D", "other"])
  writeFileSync(path.join(fx, "T001.txt"), "main's own T001\n")
  git(["add", "T001.txt"])
  git(["commit", "-q", "-m", "main: T001.txt"])
  await refusedMerge(/conflicts with main in T001\.txt\. The merge was aborted/)
  git(["reset", "-q", "--keep", "HEAD~1"])
  assert.equal(git(["rev-parse", "HEAD"]).trim(), mainHead)
  writeFileSync(path.join(fx, ".gh-stub-logged-out"), "")
  const loggedOut = await post("/api/workers/pr", { id: w.id })
  const lo = await loggedOut.json()
  assert.equal(loggedOut.status, 409)
  assert.match(lo.error, /gh auth login/)
  assert.deepEqual(lo.commands, ["git push -u origin vibedoc/R002", "gh pr create --fill --base main --head vibedoc/R002"])
  assert.equal(onOrigin("vibedoc/R002"), false, "nothing pushed")
  rmSync(path.join(fx, ".gh-stub-logged-out"))
  console.log("ok  merge refused (dirty src/, other branch, conflict aborted) with main unchanged; PR logged out → commands")

  // 4. browser: Open PR, Merge (with a modified task file), then the offered Remove
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

    await panel.getByRole("button", { name: "Open PR" }).click()
    const prDialog = page.getByRole("dialog", { name: "Push and open a pull request?" })
    await prDialog.getByText("git push -u origin vibedoc/R002").waitFor()
    await prDialog.getByText("gh pr create --fill --base main --head vibedoc/R002").waitFor()
    await prDialog.getByRole("button", { name: "Push and open PR" }).click()
    await prDialog.waitFor({ state: "hidden" })
    assert.equal(await panel.getByRole("link", { name: "Pull request" }).getAttribute("href"), "https://github.com/example/fixture/pull/1")
    assert.equal(onOrigin("vibedoc/R002"), true, "the branch is on origin")

    appendFileSync(path.join(fx, "plans/tasks/T001-task.md"), "\nA worker's note\n")
    await panel.getByRole("button", { name: "Merge into main" }).click()
    const mergeDialog = page.getByRole("dialog", { name: "Merge vibedoc/R002 into main?" })
    await mergeDialog.getByText("git merge --no-ff --no-edit vibedoc/R002").waitFor()
    await mergeDialog.getByRole("button", { name: "Merge", exact: true }).click()
    await mergeDialog.waitFor({ state: "hidden" })
    await panel.getByText("Merged into main.").waitFor()
    assert.equal(await panel.getByRole("button", { name: "Merge into main" }).count(), 0, "no Merge once merged")

    const dialog = page.getByRole("dialog", { name: "Remove the worktree?" })
    assert.equal(await dialog.getByLabel("Also delete branch vibedoc/R002").isChecked(), true, "merged → delete branch ticked")
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
    console.log("ok  the finish panel lists the commit and file; Open PR shows the link; Merge offers Remove, which asks to discard (S6)")
  } finally {
    await browser.close()
  }

  // 5. gone; main has the merge, its task file change kept
  assert.ok(!existsSync(dir), "the worktree folder is gone")
  assert.ok(!git(["worktree", "list", "--porcelain"]).includes(dir), "git worktree list no longer has it")
  assert.equal(git(["branch", "--list", "vibedoc/R002"]).trim(), "", "the branch is deleted")
  assert.equal(git(["branch", "--show-current"]).trim(), "main")
  assert.equal(git(["rev-parse", "HEAD^1"]).trim(), mainHead, "a merge commit on the old HEAD")
  assert.equal(git(["log", "-1", "--format=%B"]).trim(), "Merge branch 'vibedoc/R002'")
  assert.ok(existsSync(path.join(fx, "README.md")) && existsSync(path.join(fx, "T001.txt")))
  assert.match(readFileSync(path.join(fx, "plans/tasks/T001-task.md"), "utf8"), /A worker's note/)
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => l.slice(3))
  assert.ok(changed.every((f) => /^(plans\/|\.vibedoc)/.test(f)), `main checkout changes: ${changed}`)
  const saved = savedChat(w.id).worker
  assert.ok(saved.removedAt && saved.mergedAt, "the chat stays, marked merged and removed")
  assert.equal(saved.prUrl, "https://github.com/example/fixture/pull/1")
  assert.equal((await post("/api/workers/remove", { id: w.id })).status, 409)
  dir = null
  console.log("ok  folder and branch gone, chat kept; main has the merge commit and keeps its task file change")
} finally {
  if (dir) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
  rmSync(origin, { recursive: true, force: true })
}
