// Check for R108 T558: a worker asks mid-task, waits on the user, and the answer resumes that task's session.
//   1. POST /api/workers on R002 (T001 asks, then T002) → the stub calls vibedoc_ask_questions and exits with T001
//      in-progress → phase wait-user, the saved reply has the question card, /api/inbox counts the worker as
//      "Worker · vibedoc/R002 · T001", T002 is not claimed (S3).
//   2. Browser: /chat?id= shows the card, the header's Inbox badge counts it; Submit an answer → the next stub call is
//      `--resume stub-worker-T001` with cwd = the worktree (its .claude-stub.log), T001 is done, the loop claims T002
//      and the worker ends (S3). Fails on any browser console error.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3083 pnpm exec next start -p 3083   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3083 PW_DIR=<dir with node_modules/playwright> node e2e/worker-ask.mjs
// Writes only a fresh mktemp fixture and its worktree under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3083"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const status = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8").match(/\*\*Status:\*\* (.+)/)[1]
  .toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-")
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
async function until(fn, what, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

// Fixture: R002 with T001 + T002; .claude-stub-ask (committed, so the worktree has it) makes T001 ask first
const task = (id) => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** R002\n\n## Goal\nWrite ${id}.txt\n`)
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002\n")
task("T001"); task("T002")
writeFileSync(path.join(fx, ".claude-stub-ask"), "T001\n")
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ workers: { verify: false } })) // T568's review gate: e2e/worker-verify.mjs
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)

let dir = null
try {
  // 1. the worker asks and waits
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dir = w.dir
  await until(() => savedChat(w.id).worker.phase === "wait-user", "worker waits on the user")
  const chat = savedChat(w.id)
  assert.deepEqual(chat.worker.turns.map((t) => [t.taskId, t.result, t.sessionId]), [["T001", "in-progress", "stub-worker-T001"]])
  const last = chat.messages[chat.messages.length - 1]
  assert.equal(last.role, "assistant")
  assert.equal(last.questions.length, 1, "the saved reply has the question card")
  assert.equal(last.questions[0].questions[0].header, "Storage")
  assert.equal(status("T001"), "in-progress")
  assert.equal(status("T002"), "todo", "no next task claimed")
  const inbox = await (await fetch(`${BASE}/api/inbox?project=${encodeURIComponent(projectId)}`)).json()
  const row = inbox.find((i) => i.kind === "chat-waiting" && i.id === w.id)
  assert.ok(row, `inbox: ${JSON.stringify(inbox)}`)
  assert.equal(row.title, "Worker · vibedoc/R002 · T001")
  assert.equal((await post("/api/workers/answer", { id: w.id, message: "" })).status, 400)
  console.log("ok  the stub asks → wait-user, the card is saved, /api/inbox counts the worker, T002 not claimed (S3)")

  // 2. answer from the chat page
  const browser = await launchChrome()
  const errors = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
    const page = await ctx.newPage()
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto(`${BASE}/chat?id=${w.id}`)
    const pane = page.getByRole("region", { name: /Worker R002/ })
    await pane.locator("[data-worker-strip]").getByText("Waiting on you").waitFor()
    const card = pane.locator("[data-question-card]")
    await card.getByText("Which storage should T001 use?").waitFor()
    await page.locator("#inbox-badge [data-inbox-count]").waitFor()
    assert.ok(Number(await page.locator("#inbox-badge [data-inbox-count]").textContent()) >= 1)
    console.log("ok  the chat shows the question, the header's Inbox badge counts it")

    await card.getByLabel("SQLite").check()
    await card.getByRole("button", { name: "Submit" }).click()
    await until(() => savedChat(w.id).worker.phase === "ended", "worker ended after the answer")
    const after = savedChat(w.id)
    assert.deepEqual(after.worker.turns.map((t) => [t.taskId, t.result]), [["T001", "in-progress"], ["T001", "done"], ["T002", "done"]])
    assert.equal(after.worker.reason, "Epic finished")
    assert.ok(after.messages.some((m) => m.role === "user" && m.text === "Answers:\n- Storage: SQLite"), "the answer is in the chat")
    assert.equal(after.messages.find((m) => m.questions?.length)?.questions[0].answers?.[0], "SQLite", "the card is answered")
    const calls = readFileSync(path.join(dir, ".claude-stub.log"), "utf8").split(/^(?=-p )/m)
    assert.equal(calls.length, 3)
    assert.match(calls[1], /^-p Answers:\n- Storage: SQLite --resume stub-worker-T001 /, "the answer resumes T001's session")
    assert.ok(calls[1].includes(`?root=${encodeURIComponent(fx)}`) && calls[1].includes("--append-system-prompt"))
    assert.match(calls[2], /^-p \/vibedoc:work T002\b/)
    assert.ok(!existsSync(path.join(fx, ".claude-stub.log")), "no stub call ran in the main checkout (cwd = the worktree)")
    assert.deepEqual(git(["log", "--format=%s", "main..vibedoc/R002"]).trim().split("\n"), ["feat: T002", "feat: T001"])
    assert.equal(status("T001"), "done")
    assert.equal(status("T002"), "done")
    await pane.locator("[data-worker-strip]").getByText("Ended").waitFor()
    await pane.getByText(/^Done T001/).first().waitFor()
    console.log("ok  Submit → --resume stub-worker-T001 in the worktree, T001 done, the loop claims T002, the worker ends (S3)")

    const again = await post("/api/workers/answer", { id: w.id, message: "more" })
    assert.equal(again.status, 409, "an ended worker takes no answer")
    assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
  } finally {
    await browser.close()
  }
} finally {
  if (dir) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
