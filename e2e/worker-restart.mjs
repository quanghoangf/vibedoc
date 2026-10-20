// Check for R108 T556: a worker survives a VibeDoc restart (S5). Starts and restarts its own server (`next start`,
// after `pnpm build`) with e2e/fixtures/claude-stub first on PATH and a fresh VIBEDOC_HOME; the stub's task turn is
// slow (STUB_MS), so the restart lands mid-task.
//   1. Restart mid-T001 and send nothing: the stub's own MCP call brings the worker back, T001's reply lands in
//      .vibedoc/chats/<id>.json with every tab closed, and T002 starts after the restart.
//   2. Restart mid-T003, then open the chat: it replays the lines from before the restart (the Refused row), then
//      shows T003's reply, the Task T004 divider and T004's reply, in that order (S5).
//   3. Stop the server, kill the stub, start again: the worker shows "Interrupted" with Resume; Resume runs
//      `--resume stub-worker-T005` with cwd = the worktree, T005 is done and the worker ends (S5).
//   4. No worktree gains anything but the agent's own work (the log and state live in <home>/worktrees/<project>/
//      .vibedoc-workers/). Fails on any browser console error.
//   5. T568 (workers.verify on): kill T006's review turn while VibeDoc is down → Interrupted, a note in the orchestrator
//      chat; Resume reruns the review (fresh), it is clean and the worker ends.
//
//   pnpm build && PW_DIR=<dir with node_modules/playwright> PORT=3083 node e2e/worker-restart.mjs
// Writes only a fresh mktemp fixture and a mktemp VIBEDOC_HOME (both removed at the end).
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const PORT = Number(process.env.PORT ?? 3083)
const BASE = `http://localhost:${PORT}`
const STUB_MS = 8000
const repo = path.resolve(import.meta.dirname, "..")
if (!existsSync(path.join(repo, ".next/BUILD_ID"))) { console.error("Run `pnpm build` first: this script starts `next start`."); process.exit(2) }
const home = mkdtempSync(path.join(tmpdir(), "vibedoc-home-"))
process.env.VIBEDOC_HOME = home // registerProject writes the hub here
const { launchChrome, makeFixture, registerProject } = await import("./stub-chat.mjs")

const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify(body) })
const status = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8").match(/\*\*Status:\*\* (.+)/)[1]
  .toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-")
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
const turns = (id) => savedChat(id).worker.turns.map((t) => [t.taskId, t.result])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, what, ms = 30000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await sleep(100) }
  assert.fail(`timed out: ${what}`)
}
// the worker's process state, outside the worktree: <home>/worktrees/<project>/.vibedoc-workers/<id>.json
const stateFile = (id) => {
  const root = path.join(home, "worktrees")
  for (const p of existsSync(root) ? readdirSync(root) : []) {
    const f = path.join(root, p, ".vibedoc-workers", `${id}.json`)
    if (existsSync(f)) return f
  }
  return null
}
const procState = (id) => { const f = stateFile(id); return f ? JSON.parse(readFileSync(f, "utf8")) : null }
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

let server = null
async function startServer() {
  server = spawn(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
    cwd: repo, detached: true, stdio: "ignore",
    env: { ...process.env, PATH: `${path.join(repo, "e2e/fixtures/claude-stub")}:${process.env.PATH}`, VIBEDOC_HOME: home, PORT: String(PORT) },
  })
  await until(() => fetch(`${BASE}/api/projects`).then((r) => r.ok, () => false), "server up")
}
async function stopServer() {
  if (!server) return
  const s = server
  server = null
  const exited = new Promise((r) => s.once("exit", r))
  try { process.kill(-s.pid, "SIGTERM") } catch { /* gone */ }
  // the process, not only its port: a server still shutting down would see the stub die and fold the turn itself.
  // Next's graceful stop waits on open tabs' SSE connections, so it gets SIGKILL after 3 s (like a crash).
  if (await Promise.race([exited.then(() => true), sleep(3000).then(() => false)])) return
  try { process.kill(-s.pid, "SIGKILL") } catch { /* gone */ }
  await Promise.race([exited, sleep(5000).then(() => assert.fail("server did not exit"))])
}

// Fixture: R002 (T001, T002), R003 (T003, T004), R004 (T005); workers.env passes the stub's delay on (T557's minimal env)
const task = (id, epic) => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** ${epic}\n\n## Goal\nWrite ${id}.txt\n`)
const epic = (id, tasks) => writeFileSync(path.join(fx, `plans/roadmap/${id}-epic.md`), `# ${id}: Epic ${id}\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** ${tasks.join(", ")}\n`)
epic("R002", ["T001", "T002"]); task("T001", "R002"); task("T002", "R002")
epic("R003", ["T003", "T004"]); task("T003", "R003"); task("T004", "R003")
epic("R004", ["T005"]); task("T005", "R004")
const settings = (verify) => writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ workers: { env: ["CLAUDE_STUB_WORKER_MS", "CLAUDE_STUB_VERIFY_MS"], verify } }))
settings(false) // sections 1–3; T568's review gate in 5
epic("R005", ["T006"]); task("T006", "R005")
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)
process.env.CLAUDE_STUB_WORKER_MS = String(STUB_MS) // the server's env; workers.env hands it to the stub
process.env.CLAUDE_STUB_VERIFY_MS = String(STUB_MS)

const dirs = []
const ids = []
async function startWorker(epicId, taskId) {
  const res = await post("/api/workers", { target: { kind: "epic", id: epicId } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dirs.push(w.dir)
  ids.push(w.id)
  // the stub runs once its state file names it and it wrote its env file
  await until(() => procState(w.id)?.taskId === taskId && alive(procState(w.id).pid) && existsSync(path.join(w.dir, ".claude-stub-env.json")), `${taskId} stub started`)
  return w
}

const browser = await launchChrome()
const errors = []
try {
  await startServer()

  // 1. restart mid-task, nothing asks: the stub's MCP call brings the loop back, the chat file is written by the server
  const w1 = await startWorker("R002", "T001")
  const pid1 = procState(w1.id).pid
  await stopServer()
  assert.ok(alive(pid1), "the task's process outlives the server")
  await startServer()
  await until(() => turns(w1.id)[0]?.[1] === "done", "T001's turn saved after the restart", STUB_MS + 15000)
  const c1 = savedChat(w1.id)
  assert.ok(c1.messages.some((m) => m.role === "assistant" && m.text.startsWith("Done T001")), "T001's reply is in the chat file")
  await until(() => turns(w1.id)[1]?.[0] === "T002", "T002 starts after the restart")
  await until(() => savedChat(w1.id).worker.phase === "ended", "worker R002 ends", STUB_MS + 15000)
  assert.deepEqual(turns(w1.id), [["T001", "done"], ["T002", "done"]])
  assert.deepEqual(git(["log", "--format=%s", "main..vibedoc/R002"]).trim().split("\n"), ["feat: T002", "feat: T001"])
  console.log("ok  restart mid-T001 with no tab open → the process goes on, its reply lands in the chat file, T002 runs after (S5)")

  // 2. restart mid-task, then the page follows it again: replay first, then live, then the next task
  const w2 = await startWorker("R003", "T003")
  await stopServer()
  await startServer()
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
  const page = await ctx.newPage()
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${BASE}/chat?id=${w2.id}`)
  const pane = page.getByRole("region", { name: /Worker R003/ })
  await pane.getByRole("note", { name: "Refused" }).getByText("git push origin HEAD").first().waitFor()
  assert.equal(await pane.getByText(/^Done T003/).count(), 0, "the page is back before T003 ends")
  await pane.getByText(/^Done T003/).first().waitFor({ timeout: STUB_MS + 10000 })
  await pane.getByRole("separator", { name: "Task T004" }).waitFor()
  await pane.getByText(/^Done T004/).first().waitFor({ timeout: STUB_MS + 10000 })
  await pane.locator("[data-worker-strip]").getByText("Ended").waitFor()
  const text = (await pane.innerText()).toLowerCase() // the divider's label is uppercased by CSS
  const order = ["git push origin head", "done t003", "task t004", "done t004"].map((s) => text.indexOf(s))
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), `in order: ${order}`)
  assert.equal(await pane.getByText("Interrupted").count(), 0)
  console.log("ok  restart mid-T003 → the chat replays the lines from before, then T003's reply, the T004 divider and its reply, in order (S5)")

  // 3. the process dies while VibeDoc is down → Interrupted + Resume, which resumes that task's session in the worktree
  await page.goto("about:blank") // a tab open across a killed server logs connection errors
  const w3 = await startWorker("R004", "T005")
  await stopServer()
  process.kill(-procState(w3.id).pid, "SIGTERM")
  await until(() => !alive(procState(w3.id).pid), "stub killed")
  await startServer()
  await page.goto(`${BASE}/chat?id=${w3.id}`)
  const pane3 = page.getByRole("region", { name: /Worker R004/ })
  await pane3.locator("[data-worker-strip]").getByText("Interrupted").waitFor()
  const t5 = savedChat(w3.id).worker.turns[0]
  assert.deepEqual([t5.taskId, t5.result, t5.sessionId], ["T005", "interrupted", "stub-worker-T005"])
  assert.equal(savedChat(w3.id).worker.phase, "wait-user")
  assert.equal(status("T005"), "in-progress")
  await pane3.getByRole("button", { name: "Resume" }).click()
  await until(() => savedChat(w3.id).worker.phase === "ended", "worker R004 ends after Resume", STUB_MS + 15000)
  assert.deepEqual(turns(w3.id), [["T005", "interrupted"], ["T005", "done"]])
  const calls = readFileSync(path.join(w3.dir, ".claude-stub.log"), "utf8").split(/^(?=-p )/m)
  assert.equal(calls.length, 2)
  assert.match(calls[1], /^-p Continue task T005\. --resume stub-worker-T005 /, "Resume passes that task's session")
  assert.ok(!existsSync(path.join(fx, ".claude-stub.log")), "no stub call ran in the main checkout (cwd = the worktree)")
  assert.equal(status("T005"), "done")
  await pane3.locator("[data-worker-strip]").getByText("Ended").waitFor()
  assert.equal((await post("/api/workers/resume", { id: w3.id })).status, 409, "only an interrupted worker resumes")
  console.log("ok  stub killed while VibeDoc was down → Interrupted + Resume; Resume = --resume stub-worker-T005 in the worktree, T005 done (S5)")

  // 5. T568: the review turn is a detached process too: killed while VibeDoc is down → Interrupted, Resume reruns the review
  settings(true)
  await page.goto("about:blank")
  const w5 = await startWorker("R005", "T006")
  await until(() => procState(w5.id)?.startedAt === savedChat(w5.id).worker.turns[1]?.startedAt && alive(procState(w5.id).pid), "T006's review started", STUB_MS + 15000)
  assert.equal(savedChat(w5.id).worker.turns[1].kind, "verify")
  await stopServer()
  assert.ok(alive(procState(w5.id).pid), "the review's process outlives the server")
  process.kill(-procState(w5.id).pid, "SIGTERM")
  await until(() => !alive(procState(w5.id).pid), "review stub killed")
  await startServer()
  await page.goto(`${BASE}/chat?id=${w5.id}`)
  const pane5 = page.getByRole("region", { name: /Worker R005/ })
  await pane5.locator("[data-worker-strip]").getByText("Interrupted").waitFor()
  assert.deepEqual(turns(w5.id), [["T006", "done"], ["T006", "interrupted"]])
  assert.ok(readFileSync(path.join(fx, ".vibedoc/chats/orchestrator.json"), "utf8").includes("T006: Interrupted"), "the orchestrator gets a note")
  await pane5.getByRole("button", { name: "Resume" }).click()
  await until(() => savedChat(w5.id).worker.phase === "ended", "worker R005 ends after Resume", STUB_MS + 15000)
  assert.deepEqual(turns(w5.id), [["T006", "done"], ["T006", "interrupted"], ["T006", "clean"]])
  assert.deepEqual(savedChat(w5.id).worker.turns.map((t) => t.kind ?? "task"), ["task", "verify", "verify"], "Resume reruns the review")
  console.log("ok  review killed while VibeDoc was down → Interrupted (orchestrator note) + Resume reruns the review, clean, worker ends")

  // 4. the worktrees hold the agent's work only
  for (const dir of dirs) {
    const extra = git(["status", "--porcelain", "--untracked-files=all"], dir).trim().split("\n").filter((l) => l && !/ \.claude-stub[^/]*$/.test(l))
    assert.deepEqual(extra, [], `${dir}: nothing but the stub's own files`)
    assert.ok(!readdirSync(dir).some((f) => f === ".vibedoc-workers" || f.endsWith(".ndjson")), `${dir}: no worker log inside`)
  }
  assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
  console.log("ok  nothing new inside the worktrees apart from the agent's work; the log and state live outside")
} finally {
  await browser.close()
  for (const id of ids) { const s = procState(id); if (s && alive(s.pid)) try { process.kill(-s.pid, "SIGTERM") } catch { /* gone */ } }
  await stopServer().catch(() => {})
  for (const dir of dirs) { try { git(["worktree", "remove", "--force", dir]) } catch { rmSync(dir, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
  rmSync(home, { recursive: true, force: true })
}
