// API check for R108 T554: a worker works through an epic task by task in its own worktree.
//   1. POST /api/workers on an epic with two ready tasks → two stub calls (fresh sessions, one task each), two
//      commits on vibedoc/R002, the board moves over SSE, the main checkout has no code change.
//   2. The worker argv: ?root=<main root>, --strict-mcp-config, push denied, six built-in tools (never `--tools ''`).
//   3. A second worker on a running epic → 409. Cancel mid-task → the process is gone, the task stays in-progress,
//      no next task is claimed.
// With PLAYGROUND=1 (server started with VIBEDOC_PLAYGROUND=1) it only checks POST /api/workers → 403.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 node e2e/worker-run.mjs
// Writes only a fresh mktemp fixture and its worktrees under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { makeFixture } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
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
task("T001", "R002"); task("T002", "R002"); task("T003", "R003"); task("T004", "R003", "T003")
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

  // 3. cancel mid-task
  const r3 = await (await post("/api/workers", { target: { kind: "epic", id: "R003" } })).json()
  assert.ok(r3.dir, JSON.stringify(r3))
  dirs.push(r3.dir)
  await until(() => status("T003") === "in-progress" && existsSync(path.join(r3.dir, ".claude-stub.log")), "T003 claimed and the stub started")
  assert.equal((await post("/api/workers/cancel", { id: r3.id })).status, 200)
  await until(() => savedChat(r3.id).worker.phase === "stopped", "worker stopped")
  await new Promise((r) => setTimeout(r, 2500)) // past the stub's 2s: a live process would commit now
  assert.equal(git(["log", "--format=%s", "main..vibedoc/R003"]).trim(), "", "the killed turn committed nothing")
  assert.equal(status("T003"), "in-progress")
  assert.equal(status("T004"), "todo")
  assert.deepEqual(savedChat(r3.id).worker.turns.map((t) => [t.taskId, t.result]), [["T003", "stopped"]])
  assert.equal((await post("/api/workers/cancel", { id: r3.id })).status, 404)
  console.log("ok  cancel mid-task → the process is gone, T003 stays in-progress, nothing else claimed")
} finally {
  sse.abort()
  for (const d of dirs) { try { git(["worktree", "remove", "--force", d]) } catch { rmSync(d, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
