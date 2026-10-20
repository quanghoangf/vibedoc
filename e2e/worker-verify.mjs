// Check for R108 T568: each task a worker finishes gets a review turn (R067) before the next claim (S11).
//   1. R002 (T001 gets one major finding, then T002): T001 done → review (its verify context lists the commit on the
//      worker's branch, not main's) → major → one fix turn resuming T001's session with the findings → review clean →
//      T002 → review clean → the worker ends.
//   2. R003 (T003 always major, then T004): T003 done → review → fix → review still major → T003 sent back (todo, a
//      "changes requested" entry with the finding) and the worker waits on the user; T004 is not claimed.
//   3. workers.verify: false → R004's T005 runs with no review turn.
//   4. Browser: /chat?id= of the first worker shows a "Verify T001" divider next to "Task T001". No console errors.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 node e2e/worker-verify.mjs
// Writes only a fresh mktemp fixture and its worktrees under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const taskFile = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8")
const status = (id) => taskFile(id).match(/\*\*Status:\*\* (.+)/)[1].toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-")
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
const turns = (id) => savedChat(id).worker.turns.map((t) => [t.taskId, t.kind ?? "task", t.result])
const settings = (workers) => writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ workers }))
async function until(fn, what, ms = 30000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

// Fixture: three epics; .claude-stub-findings (committed, so every worktree has it) drives the stub's reviews
const task = (id, epic) => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** ${epic}\n\n## Goal\nWrite ${id}.txt\n`)
const epic = (id, order, tasks) => writeFileSync(path.join(fx, `plans/roadmap/${id}-epic.md`), `# ${id}: Epic ${id}\n**Parent:** R001\n**Status:** planned\n**Order:** ${order}\n**Tasks:** ${tasks.join(", ")}\n`)
epic("R002", 10, ["T001", "T002"]); task("T001", "R002"); task("T002", "R002")
epic("R003", 20, ["T003", "T004"]); task("T003", "R003"); task("T004", "R003")
epic("R004", 30, ["T005"]); task("T005", "R004")
writeFileSync(path.join(fx, ".claude-stub-findings"), JSON.stringify({ T001: "once", T003: "always" }))
writeFileSync(path.join(fx, ".gitignore"), ".claude-stub*.json\n.claude-stub.log\n.claude-stub-verify-*\n")
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)

const dirs = []
const start = async (id) => {
  const res = await post("/api/workers", { target: { kind: "epic", id } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dirs.push(w.dir)
  return w
}

try {
  // 1. a major finding once: one fix, review again, then the next task
  const a = await start("R002")
  await until(() => savedChat(a.id).worker.phase === "ended", "R002 worker ended", 45000)
  assert.deepEqual(turns(a.id), [
    ["T001", "task", "done"], ["T001", "verify", "findings"], ["T001", "fix", "done"], ["T001", "verify", "clean"],
    ["T002", "task", "done"], ["T002", "verify", "clean"],
  ])
  assert.equal(savedChat(a.id).worker.reason, "Epic finished")
  const calls = readFileSync(path.join(a.dir, ".claude-stub.log"), "utf8").split(/^(?=-p )/m)
  assert.match(calls[1], /^-p Verify task T001: call vibedoc_verify_context, then vibedoc_report_findings\. /)
  assert.ok(calls[1].includes("--tools Read,Glob,Grep,Bash ") && !calls[1].includes("--plugin-dir"), "the review is read-only")
  assert.match(calls[2], /^-p Fix this verification finding:\n- \[major\] Goal — T001\.txt says nothing useful .*--resume stub-worker-T001 /s, "the fix resumes T001's session with the findings")
  assert.match(calls[4], /^-p \/vibedoc:work T002\b/)
  // the verify context came from the worker's branch: it names the commits main doesn't have
  const ctx = readFileSync(path.join(a.dir, ".claude-stub-verify-T001.md"), "utf8")
  assert.match(ctx, /feat: T001/)
  assert.equal(git(["log", "--format=%s", "main"]).trim(), "init", "main has no worker commit")
  const fromMain = await (await post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_verify_context", arguments: { taskId: "T001" } } })).json()
  assert.doesNotMatch(fromMain.result.content[0].text, /feat: T001/, "without the worker header the context reads main's HEAD")
  assert.match(taskFile("T001"), /## Verification[\s\S]*Verified: nothing found/)
  assert.equal(status("T001"), "done")
  assert.equal(status("T002"), "done")
  console.log("ok  major once → review lists the branch's commits, one fix turn (--resume, findings), clean review, T002 claimed (S11)")

  // 2. a major finding twice: sent back, the worker waits, no next task
  const b = await start("R003")
  await until(() => savedChat(b.id).worker.phase === "wait-user", "R003 worker waits", 45000)
  assert.deepEqual(turns(b.id), [["T003", "task", "done"], ["T003", "verify", "findings"], ["T003", "fix", "done"], ["T003", "verify", "sent-back"]])
  assert.equal(savedChat(b.id).worker.reason, "T003: sent back with 1 verification finding after one fix")
  assert.equal(status("T003"), "todo")
  assert.match(taskFile("T003"), /## Review[\s\S]*changes requested\n[\s\S]*\[major\] Goal — T003\.txt says nothing useful/)
  assert.equal(status("T004"), "todo", "T004 is not claimed")
  console.log("ok  major twice → T003 sent back with the finding, the worker waits on the user, T004 not claimed (S11)")

  // 3. workers.verify: false → no review turn
  settings({ verify: false })
  const c = await start("R004")
  await until(() => savedChat(c.id).worker.phase === "ended", "R004 worker ended")
  assert.deepEqual(turns(c.id), [["T005", "task", "done"]])
  console.log("ok  workers.verify: false → T005 runs with no review turn")

  // 4. the chat shows the review as its own divider
  const browser = await launchChrome()
  const errors = []
  try {
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx2.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
    const page = await ctx2.newPage()
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto(`${BASE}/chat?id=${a.id}`)
    const pane = page.getByRole("region", { name: /Worker R002/ })
    await pane.getByRole("separator", { name: "Task T001" }).waitFor()
    assert.equal(await pane.getByRole("separator", { name: "Verify T001" }).count(), 2, "two reviews of T001")
    await pane.getByRole("separator", { name: "Verify T002" }).waitFor()
    await pane.getByText(/^Fix this verification finding:/).first().waitFor()
    assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
    console.log("ok  the worker chat shows \"Verify T001\" dividers and the fix message")
  } finally {
    await browser.close()
  }
} finally {
  for (const dir of dirs) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
