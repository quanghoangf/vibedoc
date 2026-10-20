// API check for R108 T559: a worker's UI specs run against its worktree's own app on its own port (S9).
//   1. The main project's vibedoc_get_frontend answer is unchanged (Dir app, URL :4100).
//   2. Two workers get two ports above the project's (≠ 4100); a worker's vibedoc_get_frontend names a Dir inside its
//      worktree, its own URL and a start command that really serves on that port (the fixture app prints its port).
//   3. Removing a worktree frees its port: the next worker gets it back.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3083 pnpm exec next start -p 3083   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3083 node e2e/worker-frontend.mjs
// Writes only a fresh mktemp fixture and its worktrees under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { makeFixture } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3083"
const APP_PORT = 4100
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const savedWorker = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8")).worker
async function getFrontend(workerId) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(workerId && { "x-vibedoc-worker": workerId }) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_get_frontend", arguments: {} } }),
  })
  return (await res.json()).result.content[0].text
}
// "**Dir:** apps/web (web)": the value without the package name
const field = (text, key) => text.match(new RegExp(`\\*\\*${key}:\\*\\* (.+)`))?.[1].replace(/ \(.*\)$/, "")
async function until(fn, what, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

// Fixture: three epics with one task each, an app in app/ (set by override: no package.json, so no install) that
// answers "port <PORT>", committed so every worktree has it
for (const [epic, t] of [["R002", "T001"], ["R003", "T003"], ["R004", "T004"]]) {
  writeFileSync(path.join(fx, "plans/roadmap", `${epic}-epic.md`), `# ${epic}: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** ${t}\n`)
  writeFileSync(path.join(fx, "plans/tasks", `${t}-task.md`), `# ${t}: Task ${t}\n**Status:** todo\n**Phase:** ${epic}\n\n## Goal\nWrite ${t}.txt\n`)
}
mkdirSync(path.join(fx, "app"))
writeFileSync(path.join(fx, "app/server.mjs"), `import http from "node:http"\nhttp.createServer((_, res) => res.end("port " + process.env.PORT)).listen(Number(process.env.PORT))\n`)
writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ frontend: { dir: "app", startCommand: "node server.mjs", url: `http://localhost:${APP_PORT}` } }))
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])

const workers = []
let app = null
try {
  // 1. the main project's answer
  const main = await getFrontend(null)
  assert.equal(field(main, "Dir"), "app")
  assert.equal(field(main, "URL"), `http://localhost:${APP_PORT}`)
  assert.equal(field(main, "Start command"), "node server.mjs")
  assert.ok(!main.includes("**Worktree:**"))
  console.log("ok  main project: Dir app, URL :4100, its own start command")

  // 2. two workers, two ports, each answer points into its worktree
  for (const epic of ["R002", "R003"]) {
    const res = await post("/api/workers", { target: { kind: "epic", id: epic } })
    const w = await res.json()
    assert.equal(res.status, 200, JSON.stringify(w))
    workers.push(w)
  }
  const [a, b] = workers.map((w) => savedWorker(w.id))
  assert.ok(a.port > APP_PORT && b.port > APP_PORT, `ports ${a.port}, ${b.port} sit above the project's`)
  assert.notEqual(a.port, b.port)
  console.log(`ok  two workers → ports ${a.port} and ${b.port}, neither ${APP_PORT}`)

  const reply = await getFrontend(workers[0].id)
  assert.equal(field(reply, "Dir"), path.join(a.dir, "app"))
  assert.equal(field(reply, "URL"), `http://localhost:${a.port}`)
  assert.equal(field(reply, "Start command"), `PORT=${a.port} node server.mjs`)
  assert.match(reply, new RegExp(`\\*\\*Worktree:\\*\\* \`${a.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``))
  assert.equal(field(await getFrontend(workers[1].id), "URL"), `http://localhost:${b.port}`)
  console.log("ok  worker answer: Dir inside its worktree, its own URL and start command (S9)")

  app = spawn(field(reply, "Start command"), { cwd: field(reply, "Dir"), shell: true, detached: true, stdio: "ignore" })
  let body = ""
  await until(async () => { body = await fetch(`http://localhost:${a.port}`).then((r) => r.text(), () => ""); return body }, "worker app answers")
  assert.equal(body, `port ${a.port}`)
  console.log("ok  the start command serves the worktree's app on the worker's port")

  // 3. a removed worktree frees its port
  await until(() => savedWorker(workers[0].id).phase === "ended", "first worker ended")
  process.kill(-app.pid); app = null
  git(["worktree", "remove", "--force", a.dir])
  const res = await post("/api/workers", { target: { kind: "epic", id: "R004" } })
  const c = await res.json()
  assert.equal(res.status, 200, JSON.stringify(c))
  workers.push(c)
  assert.equal(savedWorker(c.id).port, a.port)
  console.log(`ok  removing a worktree frees its port: the next worker gets ${a.port} again`)
  console.log("\nworker-frontend: all checks passed")
} finally {
  if (app) try { process.kill(-app.pid) } catch { /* gone */ }
  for (const w of workers) {
    await until(() => ["ended", "stopped", "failed", "wait-user"].includes(savedWorker(w.id).phase), `worker ${w.id} ended`).catch(() => {})
    try { git(["worktree", "remove", "--force", w.dir]) } catch { /* already removed */ }
  }
  rmSync(fx, { recursive: true, force: true })
}
