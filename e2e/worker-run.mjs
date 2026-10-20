// API check for R108 T554: a worker works through an epic task by task in its own worktree.
//   1. POST /api/workers on an epic with two ready tasks → two stub calls (fresh sessions, one task each), two
//      commits on vibedoc/R002, the board moves over SSE, the main checkout has no code change.
//   2. The worker argv: ?root=<main root>, --strict-mcp-config, push denied, six built-in tools (never `--tools ''`).
//   3. A second worker on a running epic → 409. Cancel mid-task → the process is gone, the task stays in-progress,
//      no next task is claimed.
//   T557: the stub tries `git push` → a refused call in the saved chat and a Refused row; its env has no GITHUB_TOKEN
//      unless `workers.env` lists it; a settings allowlist without the push deny still spawns with it denied;
//      `workers.maxRunning: 1` + one running → a second start is 409 naming the limit; Settings → Workers renders.
//   4. Browser (T555): epic sheet → Work with agent → run card → Start → the worker chat opens with branch, folder and the
//      current task, streams the reply, starts a divider per task; the board card moves without a reload; a reload
//      mid-task re-attaches to the running turn. Fails on any browser console error.
//   5. T567 (budget, S10): workers.maxTurnsPerTask 5 + taskTimeoutMin 1. A stub task that hits --max-turns → wait-user
//      "Turn budget reached (5)", no next task; an answer resumes it with the budget again. One that hangs → killed after
//      1 min, wait-user "Took longer than 1 min". One that hits a usage limit → paused with a retry time, not in the
//      inbox, then the task runs again by itself. Usage (turns, time, cost) is saved per turn. Takes about 70 s.
// With PLAYGROUND=1 (server started with VIBEDOC_PLAYGROUND=1) it only checks POST /api/workers → 403.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H GITHUB_TOKEN=x PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/worker-run.mjs
// Section 4 reloads mid-task: start the server with CLAUDE_STUB_WORKER_MS=4000 (the script reads the same variable; the
// fixture lists it in `workers.env`, since a worker only gets the minimal env, T557).
// Writes only a fresh mktemp fixture and its worktrees under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
const STUB_MS = Number(process.env.CLAUDE_STUB_WORKER_MS ?? 2000)
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const status = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8").match(/\*\*Status:\*\* (.+)/)[1]
  .toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-") // "🔨 In Progress" → in-progress
async function until(fn, what, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

if (process.env.PLAYGROUND) {
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  assert.equal(res.status, 403)
  console.log("ok  playground → 403")
  process.exit(0)
}

// Fixture: R002 with T001 + T002 (ready), R003 with T003 → T004 (for cancel); a git repo with one commit, no package.json
const task = (id, epic, dep = "") => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`),
  `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** ${epic}\n${dep ? `**Depends on:** ${dep}\n` : ""}\n## Goal\nWrite ${id}.txt\n`)
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001, T002\n")
writeFileSync(path.join(fx, "plans/roadmap/R003-other.md"), "# R003: Other\n**Parent:** R001\n**Status:** planned\n**Order:** 20\n**Tasks:** T003, T004\n")
writeFileSync(path.join(fx, "plans/roadmap/R004-browser.md"), "# R004: Browser\n**Parent:** R001\n**Status:** planned\n**Order:** 30\n**Tasks:** T005, T006\n")
writeFileSync(path.join(fx, "plans/roadmap/R005-limit.md"), "# R005: Limit\n**Parent:** R001\n**Status:** planned\n**Order:** 40\n**Tasks:** T007\n")
// T567: R006 T008 hits --max-turns, then T009; R007 T010 hangs; R008 T011 hits a usage limit (.claude-stub-outcomes)
writeFileSync(path.join(fx, "plans/roadmap/R006-turns.md"), "# R006: Turns\n**Parent:** R001\n**Status:** planned\n**Order:** 50\n**Tasks:** T008, T009\n")
writeFileSync(path.join(fx, "plans/roadmap/R007-time.md"), "# R007: Time\n**Parent:** R001\n**Status:** planned\n**Order:** 60\n**Tasks:** T010\n")
writeFileSync(path.join(fx, "plans/roadmap/R008-usage.md"), "# R008: Usage\n**Parent:** R001\n**Status:** planned\n**Order:** 70\n**Tasks:** T011\n")
writeFileSync(path.join(fx, ".claude-stub-outcomes"), JSON.stringify({ T008: "max-turns", T010: "hang", T011: "usage-limit" }))
task("T001", "R002"); task("T002", "R002"); task("T003", "R003"); task("T004", "R003", "T003"); task("T005", "R004"); task("T006", "R004", "T005"); task("T007", "R005")
task("T008", "R006"); task("T009", "R006", "T008"); task("T010", "R007"); task("T011", "R008")
const stubEnv = ["CLAUDE_STUB_WORKER_MS"]
const settings = (workers) => writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ workers: { env: stubEnv, ...workers } }))
settings({})
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])

const events = []
const sse = new AbortController()
void fetch(`${BASE}/api/events`, { signal: sse.signal }).then(async (res) => {
  const dec = new TextDecoder()
  for await (const chunk of res.body) for (const m of dec.decode(chunk).matchAll(/^data: (.+)$/gm)) events.push(JSON.parse(m[1]))
}).catch(() => {})

const dirs = []
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
try {
  // 1. two tasks, two fresh turns, two commits on the worker branch
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dirs.push(w.dir)
  assert.equal(w.branch, "vibedoc/R002")
  const again = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  assert.equal(again.status, 409)
  console.log("ok  a second worker on the same epic → 409")

  await until(() => savedChat(w.id).worker.phase === "ended", "worker ended")
  const chat = savedChat(w.id)
  assert.deepEqual(chat.worker.turns.map((t) => [t.taskId, t.result]), [["T001", "done"], ["T002", "done"]])
  assert.deepEqual(chat.worker.turns.map((t) => t.sessionId), ["stub-worker-T001", "stub-worker-T002"])
  assert.equal(chat.worker.reason, "Epic finished")
  assert.equal(status("T001"), "done")
  assert.equal(status("T002"), "done")
  assert.deepEqual(git(["log", "--format=%s", "main..vibedoc/R002"]).trim().split("\n"), ["feat: T002", "feat: T001"])
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => l.slice(3))
  assert.ok(changed.every((f) => /^(plans\/|\.vibedoc|\.claude-stub)/.test(f)), `main checkout code changes: ${changed}`)
  assert.ok(!existsSync(path.join(fx, "T001.txt")))
  console.log("ok  two tasks → two turns, two commits on vibedoc/R002, main checkout has no code change (S1)")

  const moves = events.filter((e) => e.type === "task_updated").map((e) => `${e.payload.taskId}:${e.payload.status}`)
  for (const m of ["T001:in-progress", "T001:done", "T002:in-progress", "T002:done"]) assert.ok(moves.includes(m), `SSE ${m} in ${moves}`)
  assert.ok(events.some((e) => e.type === "worker_updated" && e.payload.id === w.id))
  assert.ok(!existsSync(path.join(fx, ".vibedoc/agent-connection.json")), "a worker's MCP calls are not 'agent connected'")
  console.log("ok  the board moves over SSE while the worker runs (S2)")

  // 2. the argv the stub saw
  // the prompt has newlines, so one call spans several log lines: split where a call starts
  const calls = readFileSync(path.join(w.dir, ".claude-stub.log"), "utf8").split(/^(?=-p )/m)
  assert.equal(calls.length, 2)
  assert.match(calls[0], /^-p \/vibedoc:work T001\b/)
  assert.match(calls[1], /^-p \/vibedoc:work T002\b/)
  for (const c of calls) {
    assert.ok(c.includes(`?root=${encodeURIComponent(fx)}`), "MCP ?root= is the main checkout")
    assert.ok(c.includes("--strict-mcp-config"))
    assert.ok(/--disallowedTools Bash\(git push\*\)/.test(c), "push denied")
    assert.ok(c.includes("--tools Bash,Edit,Write,Read,Glob,Grep") && !/--tools {2}/.test(c), "six built-ins, never --tools ''")
    assert.ok(!c.includes("--resume"))
  }
  console.log("ok  argv: ?root=<main root>, --strict-mcp-config, push denied, no --resume, no empty --tools")

  // T557: refusals and the minimal env (the server runs with GITHUB_TOKEN=x)
  assert.deepEqual(chat.messages.filter((m) => m.role === "assistant").map((m) => m.refused),
    [[{ tool: "Bash", input: "git push origin HEAD" }], [{ tool: "Bash", input: "git push origin HEAD" }]])
  const envNames = (dir) => JSON.parse(readFileSync(path.join(dir, ".claude-stub-env.json"), "utf8"))
  assert.ok(envNames(w.dir).includes("PATH") && envNames(w.dir).includes("HOME"))
  for (const k of ["GITHUB_TOKEN", "ANTHROPIC_API_KEY", "NODE_ENV"]) assert.ok(!envNames(w.dir).includes(k), `${k} reached the worker`)
  console.log("ok  the stub's git push is saved as a refused call; its env has no GITHUB_TOKEN (S4)")
  // a settings allowlist that allows push, one worker at a time, GITHUB_TOKEN passed on
  settings({ allowedTools: ["Read", "Bash(git push*)"], maxRunning: 1, env: [...stubEnv, "GITHUB_TOKEN"] })

  // 3. cancel mid-task
  const r3 = await (await post("/api/workers", { target: { kind: "epic", id: "R003" } })).json()
  assert.ok(r3.dir, JSON.stringify(r3))
  dirs.push(r3.dir)
  await until(() => status("T003") === "in-progress" && existsSync(path.join(r3.dir, ".claude-stub-env.json")), "T003 claimed and the stub started")
  const call3 = readFileSync(path.join(r3.dir, ".claude-stub.log"), "utf8")
  assert.ok(call3.includes("--allowedTools Read Bash(git push*) --disallowedTools Bash(git push*) Bash(gh *)"), "push denied whatever the allowlist says")
  assert.ok(envNames(r3.dir).includes("GITHUB_TOKEN"), "workers.env passes GITHUB_TOKEN on")
  const limited = await post("/api/workers", { target: { kind: "epic", id: "R005" } })
  assert.equal(limited.status, 409)
  assert.match((await limited.json()).error, /limit of 1 running workers/)
  console.log("ok  settings: push still denied, workers.env passes GITHUB_TOKEN, maxRunning 1 → a second start is 409")
  assert.equal((await post("/api/workers/cancel", { id: r3.id })).status, 200)
  await until(() => savedChat(r3.id).worker.phase === "stopped", "worker stopped")
  await new Promise((r) => setTimeout(r, STUB_MS + 500)) // past the stub's delay: a live process would commit now
  assert.equal(git(["log", "--format=%s", "main..vibedoc/R003"]).trim(), "", "the killed turn committed nothing")
  assert.equal(status("T003"), "in-progress")
  assert.equal(status("T004"), "todo")
  assert.deepEqual(savedChat(r3.id).worker.turns.map((t) => [t.taskId, t.result]), [["T003", "stopped"]])
  assert.equal((await post("/api/workers/cancel", { id: r3.id })).status, 404)
  console.log("ok  cancel mid-task → the process is gone, T003 stays in-progress, nothing else claimed")
  settings({})

  // 4. the browser path (T555)
  const browser = await launchChrome()
  const errors = []
  try {
    const { id: projectId } = registerProject(fx)
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
    const page = await ctx.newPage()
    const board = await ctx.newPage()
    for (const p of [page, board]) {
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
      p.on("pageerror", (e) => errors.push(e.message))
    }
    await board.goto(`${BASE}/board`)
    const card = (col, id) => board.locator(`[data-column="${col}"]`).getByLabel(`${id} Task ${id}`)
    // the done column folds its cards into a list of ids
    const done = (id) => board.locator('[data-column="done"]').getByText(id, { exact: true })
    await card("todo", "T005").waitFor()

    await page.goto(`${BASE}/roadmap?item=R004`)
    await page.getByRole("button", { name: "Work with agent" }).click()
    const runCard = page.getByRole("form", { name: "Work on R004 with an agent" })
    assert.equal(await runCard.getByLabel("Branch").inputValue(), "vibedoc/R004")
    assert.equal(await runCard.getByLabel("Base").inputValue(), "HEAD")
    await runCard.getByText("Bash(git push*)").waitFor()
    await runCard.getByRole("button", { name: "Start worker" }).click()

    const chatBox = page.getByRole("dialog")
    const strip = chatBox.locator("[data-worker-strip]")
    await strip.getByText("vibedoc/R004").waitFor()
    await strip.getByText(/worktrees.*vibedoc-r004/).waitFor()
    await strip.getByText("Working on T005").waitFor()
    await chatBox.getByRole("separator", { name: "Task T005" }).waitFor()
    await chatBox.getByText(/^Done T005/).first().waitFor({ timeout: STUB_MS + 10000 })
    await chatBox.getByRole("note", { name: "Refused" }).getByText("git push origin HEAD").first().waitFor()
    console.log("ok  Work with agent → run card → the worker chat shows branch, folder, the current task and streams (S1)")

    await done("T005").waitFor({ timeout: 10000 })
    await card("todo", "T005").waitFor({ state: "detached" })
    await chatBox.getByRole("separator", { name: "Task T006" }).waitFor()
    await strip.getByText("Working on T006").waitFor()
    // T567: the stub reports 3 turns, 1.5 s and $0.25 per task: the strip sums them, the divider shows its task's
    await strip.locator("[data-worker-usage]").getByText(/^3 turns · .+ · \$0\.25$/).waitFor()
    await chatBox.getByRole("separator", { name: "Task T005" }).getByText(/^3 turns · /).waitFor()
    console.log("ok  T005 done → its board card moves without a reload; the chat starts a divider for T006 (S2)")

    const workerChat = readdirSync(path.join(fx, ".vibedoc/chats")).map((f) => savedChat(f.replace(/\.json$/, ""))).find((c) => c.worker?.target.id === "R004")
    dirs.push(workerChat.worker.dir)
    await page.goto(`${BASE}/chat?id=${workerChat.id}`)
    const pane = page.getByRole("region", { name: /Worker R004/ })
    await pane.locator("[data-worker-strip]").getByText("Working on T006").waitFor()
    await pane.getByRole("button", { name: "Stop" }).first().waitFor()
    await pane.getByText(/^Done T006/).first().waitFor({ timeout: STUB_MS + 10000 })
    assert.equal(await pane.getByText("Interrupted").count(), 0)
    await pane.locator("[data-worker-strip]").getByText("Ended").waitFor()
    await done("T006").waitFor()
    console.log("ok  reload mid-task → the chat re-attaches to the running turn and shows its reply; the worker ends")

    await page.goto(`${BASE}/settings?tab=workers`)
    await page.getByText(/It is not a sandbox/).waitFor()
    assert.match(await page.getByLabel("Allowed tools").inputValue(), /^mcp__vibedoc__\*$/m)
    await page.getByText("Bash(git push*)").waitFor()
    await page.getByLabel("Environment variables").fill("GITHUB_TOKEN")
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByRole("status").getByText("Saved").waitFor()
    assert.deepEqual(JSON.parse(readFileSync(path.join(fx, ".vibedoc/settings.json"), "utf8")).workers.env, ["GITHUB_TOKEN"])
    console.log("ok  Settings → Workers: the not-a-sandbox line, the default allowlist, the deny rules; Save writes workers.env")
    assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
  } finally {
    await browser.close()
  }

  // 5. T567: the budget per task and the usage-limit pause (S10)
  settings({ maxRunning: 3, maxTurnsPerTask: 5, taskTimeoutMin: 1 })
  const start = async (epic) => {
    const r = await (await post("/api/workers", { target: { kind: "epic", id: epic } })).json()
    assert.ok(r.dir, JSON.stringify(r))
    dirs.push(r.dir)
    return r
  }
  const hang = await start("R007")
  const usage = await start("R008")
  const turns = await start("R006")

  await until(() => savedChat(usage.id).worker.phase === "paused", "usage-limit worker paused")
  const uw = savedChat(usage.id).worker
  assert.ok(Date.parse(uw.retryAt) > Date.now() - 5000, `retryAt ${uw.retryAt}`)
  assert.deepEqual(uw.turns.map((t) => [t.taskId, t.result]), [["T011", "usage-limit"]])
  const inbox = await (await fetch(`${BASE}/api/inbox?project=${encodeURIComponent(registerProject(fx).id)}`)).json()
  assert.ok(!inbox.some((i) => i.id === usage.id), `a paused worker is not in the inbox: ${JSON.stringify(inbox)}`)
  console.log("ok  a usage limit → phase paused with a retry time, not in the inbox (S10)")
  await until(() => savedChat(turns.id).worker.phase === "wait-user", "max-turns worker waits")
  let tw = savedChat(turns.id).worker
  assert.equal(tw.reason, "T008: Turn budget reached (5)")
  assert.deepEqual(tw.turns.map((t) => [t.taskId, t.result]), [["T008", "over-turns"]])
  assert.equal(tw.turns[0].usage.turns, 6)
  assert.equal(status("T008"), "in-progress")
  assert.equal(status("T009"), "todo")
  assert.match(readFileSync(path.join(turns.dir, ".claude-stub.log"), "utf8"), /--max-turns 5 /)
  console.log("ok  --max-turns 5 reached → the task stops, wait-user \"Turn budget reached (5)\", T009 not claimed (S10)")
  assert.equal((await post("/api/workers/answer", { id: turns.id, message: "Go on." })).status, 200)
  await until(() => savedChat(turns.id).worker.phase === "ended", "resumed worker ends", 30000)
  tw = savedChat(turns.id).worker
  assert.deepEqual(tw.turns.map((t) => [t.taskId, t.result]), [["T008", "over-turns"], ["T008", "done"], ["T009", "done"]])
  assert.equal(tw.turns[1].sessionId, "stub-worker-T008", "the answer resumed T008's session")
  console.log("ok  an answer resumes the over-budget task with the budget again; the worker goes on to T009")

  await until(() => savedChat(usage.id).worker.phase === "ended", "paused worker retries and ends", 30000)
  const ue = savedChat(usage.id).worker
  assert.deepEqual(ue.turns.map((t) => [t.taskId, t.result]), [["T011", "usage-limit"], ["T011", "done"]])
  assert.equal(ue.retryAt, undefined)
  assert.equal(status("T011"), "done")
  assert.deepEqual(ue.turns[1].usage, { turns: 3, durationMs: 1500, costUsd: 0.25, tokens: 3100 })
  console.log("ok  after the retry time the task runs again by itself and finishes; usage is saved per turn")

  await until(() => savedChat(hang.id).worker.phase === "wait-user", "timed-out worker waits", 90000)
  const hw = savedChat(hang.id).worker
  assert.equal(hw.reason, "T010: Took longer than 1 min")
  assert.deepEqual(hw.turns.map((t) => [t.taskId, t.result]), [["T010", "over-time"]])
  assert.ok(Date.parse(hw.turns[0].endedAt) - Date.parse(hw.turns[0].startedAt) >= 60000)
  assert.equal(status("T010"), "in-progress")
  assert.equal(git(["log", "--format=%s", "main..vibedoc/R007"]).trim(), "", "the killed turn committed nothing")
  console.log("ok  a task past taskTimeoutMin (1) → killed, wait-user \"Took longer than 1 min\" (S10)")
  settings({})
} finally {
  sse.abort()
  for (const d of dirs) { try { git(["worktree", "remove", "--force", d]) } catch { rmSync(d, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
