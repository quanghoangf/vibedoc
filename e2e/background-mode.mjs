// End-to-end check for background mode (R109): `vibedoc start` hands the terminal back while VibeDoc keeps serving.
//   1. S1: `vibedoc start --no-open` in repo A exits 0 within 60 s, prints the address, and the app still answers;
//      <home>/server.json says running with a live supervisor.
//   2. S2: `start` again in A and in repo B: exit 0, same address, same supervisorPid, one listener on the port, B in
//      /api/projects.
//   3. Plain `vibedoc` still runs in the foreground and Ctrl+C stops it.
//   4. A start failure (the app exits before it is ready) prints the reason + log tail, exits non-zero, and
//      server.json says stopped with lastError.
//   S3: `vibedoc status` exits 3 with nothing running (also a dead supervisorPid), 0 with the address, since when and
//      the log after start, "in the foreground" for plain vibedoc, the last error after a failed start; --json too.
//   5. S4: `vibedoc stop` with nothing running exits 0, with a foreground VibeDoc 1. After start + an agent worker (the
//      slow claude stub), stop names the worker, and the supervisor, server and stub are gone, the port free, status
//      exits 3; the next start shows the worker Interrupted. /api/server/shutdown refuses without the CLI header or
//      from another origin. With the server SIGSTOPped, stop still ends everything within 15 s (the sweep).
//   6. S5: SIGKILL the server → within 10 s it answers again on the same port with a new serverPid, an MCP call works,
//      and the agent worker running through the crash is still running (its chat still follows it).
//   7. Crash loop: kill it 5 times quickly → the supervisor gives up and exits, server.json says crashed, `status`
//      exits 3 and prints the last error with the log lines.
//   8. Done when: start → the parent exits → the app answers → an MCP tools/call vibedoc_get_status on the printed MCP
//      URL answers → stop → no supervisor, server or worker pid is alive and no worker turn is left.
//
//   pnpm build && PATH=$PWD/e2e/fixtures/claude-stub:$PATH node e2e/background-mode.mjs      (PORT=3090 by default)
//
// Spawns the real bin with --no-open from the `.next` build, with its own temp VIBEDOC_HOME (never ~/.vibedoc).
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "vibedoc.mjs")
const PORT = Number(process.env.PORT || 3090)
const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "vibedoc-background-e2e-")))
const home = path.join(tmp, "home")
const repo = (name) => {
  const dir = path.join(tmp, name)
  mkdirSync(path.join(dir, ".git"), { recursive: true })
  return dir
}
const repoA = repo("repo-a"), repoB = repo("repo-b")
const children = new Set()
const stubPids = new Set()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const state = (h = home) => { try { return JSON.parse(readFileSync(path.join(h, "server.json"), "utf8")) } catch { return null } }
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
/** A crash: the process dies without warning (Windows has no signals: taskkill /F). */
const crash = (pid) => process.platform === "win32" ? execFileSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" }) : process.kill(pid, "SIGKILL")
/** An MCP tools/call at `mcpUrl` → the reply's text (fails on an error reply). */
async function mcpCall(mcpUrl, name, args = {}) {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(10_000),
  })
  const d = await res.json()
  assert.equal(res.status, 200, JSON.stringify(d))
  const text = d.result?.content?.[0]?.text
  assert.ok(text && !d.result.isError, JSON.stringify(d))
  return text
}

function env(extra = {}) {
  const e = { ...process.env, VIBEDOC_HOME: home, ...extra }
  delete e.VIBEDOC_ROOT
  return e
}

/** Runs the bin to its exit → { code, out, ms }; fails after `timeoutMs`. */
function runToExit(cwd, args, { timeoutMs = 60_000, extraEnv } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const child = spawn(process.execPath, [bin, ...args, "--no-open"], { cwd, env: env(extraEnv) })
    children.add(child)
    let out = ""
    child.stdout.on("data", (d) => { out += d })
    child.stderr.on("data", (d) => { out += d })
    const timer = setTimeout(() => reject(new Error(`still running after ${timeoutMs} ms; output:\n${out}`)), timeoutMs)
    child.on("exit", (code) => { children.delete(child); clearTimeout(timer); resolve({ code, out, ms: Date.now() - started }) })
  })
}

/** Processes listening on this port (Next renames its process title, so count listeners). */
const listeners = (port) => {
  try { return new Set(execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)).size } catch { return 0 }
}
const answers = async (port) => {
  try { return (await fetch(`http://localhost:${port}/api/projects`, { signal: AbortSignal.timeout(2000) })).status } catch { return 0 }
}
async function until(what, check, ms = 15_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (await check()) return
  assert.fail(`timed out waiting for ${what}`)
}

/** Stops the background VibeDoc without `vibedoc stop` (checked on its own in 5): SIGTERM to the supervisor. */
async function stopBackground(h = home) {
  const s = state(h)
  if (s?.supervisorPid && alive(s.supervisorPid)) process.kill(s.supervisorPid, "SIGTERM")
  await until("the supervisor to stop", () => !s?.supervisorPid || !alive(s.supervisorPid))
  if (s?.serverPid && alive(s.serverPid)) process.kill(s.serverPid, "SIGKILL")
  await until("the port to free", async () => (await answers(PORT)) === 0)
}

try {
  const url = `http://localhost:${PORT}`

  // S3: with nothing running, status exits 3 and says so (--port: never see a real VibeDoc on 3333)
  const none = await runToExit(repoA, ["status", "--port", String(PORT)])
  assert.equal(none.code, 3, none.out)
  assert.ok(none.out.includes("○ VibeDoc is not running") && none.out.includes("Start it with: vibedoc start"), none.out)
  console.log("✓ status with nothing running exits 3")
  const stopNone = await runToExit(repoA, ["stop", "--port", String(PORT)])
  assert.equal(stopNone.code, 0, stopNone.out)
  assert.ok(stopNone.out.includes("○ VibeDoc is not running"), stopNone.out)
  console.log("✓ stop with nothing running exits 0 and says not running")

  // 1. S1: start hands the terminal back, the app keeps answering
  const first = await runToExit(repoA, ["start", "--port", String(PORT)])
  assert.equal(first.code, 0, first.out)
  assert.ok(first.ms < 60_000, `exited within 60 s (took ${first.ms} ms)`)
  assert.ok(first.out.includes(`✓ VibeDoc is running in the background at ${url}`), first.out)
  assert.ok(first.out.includes(`MCP:     ${url}/api/mcp?root=${encodeURIComponent(repoA)}`), "the existing banner")
  assert.ok(first.out.includes(path.join(home, "logs", "server.log")), "names the log")
  assert.equal(await answers(PORT), 200, "the app answers after start exited")
  await until("server.json running", () => state()?.state === "running", 5000)
  const s1 = state()
  assert.equal(s1.port, PORT)
  assert.ok(alive(s1.supervisorPid) && alive(s1.serverPid), "supervisor and server are alive")
  assert.equal(s1.log, path.join(home, "logs", "server.log"))
  assert.deepEqual(s1.restarts, [])
  assert.equal(s1.lastError, null)
  assert.ok(!Number.isNaN(Date.parse(s1.startedAt)))
  assert.ok(readFileSync(s1.log, "utf8").includes("supervisor: running on"), "the supervisor logs to server.log")
  console.log(`✓ start exits in ${first.ms} ms and VibeDoc keeps answering at ${url}`)

  // S3: status after start: exit 0, the address, since when, the log; --json is valid JSON with running
  const st = await runToExit(repoB, ["status"])
  assert.equal(st.code, 0, st.out)
  assert.ok(st.out.includes(`● VibeDoc is running at ${url}`), st.out)
  assert.match(st.out, /^ {2}since \d{4}-\d\d-\d\d \d\d:\d\d \((under a minute|\d+ min)\)$/m)
  assert.ok(st.out.includes(`  log: ${path.join(home, "logs", "server.log")}`), st.out)
  const stJson = await runToExit(repoB, ["status", "--json"])
  assert.equal(stJson.code, 0, stJson.out)
  const parsed = JSON.parse(stJson.out)
  assert.equal(parsed.running, true)
  assert.equal(parsed.mode, "background")
  assert.equal(parsed.port, PORT)
  assert.equal(parsed.supervisorPid, s1.supervisorPid)
  console.log("✓ status says running at the address, since when and the log (text and --json)")

  // 2. S2: a second start reuses it, in the same repo and in another one
  for (const [cwd, name] of [[repoA, "same repo"], [repoB, "another repo"]]) {
    const again = await runToExit(cwd, ["start"])
    assert.equal(again.code, 0, again.out)
    assert.ok(again.out.includes(`✓ VibeDoc is already running at ${url}`), again.out)
    assert.ok(!again.out.includes("running in the background"), "no second server")
    assert.equal(state().supervisorPid, s1.supervisorPid, `${name}: same supervisor`)
    if (process.platform !== "win32") assert.equal(listeners(PORT), 1, `${name}: one process listens`)
  }
  const projects = await (await fetch(`${url}/api/projects`)).json()
  assert.ok(projects.some((p) => p.root === repoA) && projects.some((p) => p.root === repoB), "both repos in the hub")
  console.log("✓ a second start reuses the running VibeDoc; repo B joins it")

  // 3. plain vibedoc stays in the foreground; Ctrl+C stops it
  await stopBackground()
  // a server.json whose supervisor is dead counts as not running, and status doesn't rewrite it
  const stale = readFileSync(path.join(home, "server.json"), "utf8")
  writeFileSync(path.join(home, "server.json"), JSON.stringify({ ...JSON.parse(stale), state: "running" }))
  const staleBefore = readFileSync(path.join(home, "server.json"), "utf8")
  assert.ok(!alive(JSON.parse(staleBefore).supervisorPid))
  const staleStatus = await runToExit(repoA, ["status", "--port", String(PORT)])
  assert.equal(staleStatus.code, 3, staleStatus.out)
  assert.ok(staleStatus.out.includes("○ VibeDoc is not running"), staleStatus.out)
  assert.equal(readFileSync(path.join(home, "server.json"), "utf8"), staleBefore, "status leaves server.json alone")
  writeFileSync(path.join(home, "server.json"), stale)
  console.log("✓ a dead supervisorPid in server.json counts as not running")
  const fg = spawn(process.execPath, [bin, "--no-open"], { cwd: repoA, env: env() })
  children.add(fg)
  let fgOut = ""
  fg.stdout.on("data", (d) => { fgOut += d })
  fg.stderr.on("data", (d) => { fgOut += d })
  await until("the foreground server", () => fgOut.includes("Press Ctrl+C"), 60_000)
  assert.equal(fg.exitCode, null, "foreground keeps running")
  assert.equal(await answers(PORT), 200)
  const fgStatus = await runToExit(repoB, ["status"])
  assert.equal(fgStatus.code, 0, fgStatus.out)
  assert.ok(fgStatus.out.includes(`● VibeDoc is running in the foreground at ${url} (not started with \`vibedoc start\`)`), fgStatus.out)
  const fgJson = JSON.parse((await runToExit(repoB, ["status", "--json"])).out)
  assert.deepEqual([fgJson.running, fgJson.mode, fgJson.port], [true, "foreground", PORT])
  const fgStop = await runToExit(repoB, ["stop"])
  assert.equal(fgStop.code, 1, fgStop.out)
  assert.ok(fgStop.out.includes(`running in the foreground at ${url}: press Ctrl+C in its terminal`), fgStop.out)
  assert.equal(fg.exitCode, null, "stop leaves a foreground VibeDoc alone")
  fg.kill("SIGINT")
  await until("the foreground to exit", () => fg.exitCode !== null)
  await until("the port to free after Ctrl+C", async () => (await answers(PORT)) === 0)
  console.log("✓ plain vibedoc still runs in the foreground and Ctrl+C stops it")

  // S2 under a race: two starts at the same moment make one server (the start lock), both print its address
  const [r1, r2] = await Promise.all([runToExit(repoA, ["start"]), runToExit(repoB, ["start"])])
  assert.equal(r1.code, 0, r1.out)
  assert.equal(r2.code, 0, r2.out)
  const launched = [r1, r2].filter((r) => r.out.includes(`running in the background at ${url}`)).length
  const reused = [r1, r2].filter((r) => r.out.includes(`already running at ${url}`)).length
  assert.deepEqual([launched, reused], [1, 1], `one launches, one reuses:\n${r1.out}\n---\n${r2.out}`)
  const raced = state()
  assert.equal(raced.state, "running", "server.json isn't overwritten by a failed second supervisor")
  assert.equal(raced.lastError, null)
  assert.ok(alive(raced.supervisorPid))
  if (process.platform !== "win32") assert.equal(listeners(PORT), 1, "one process listens")
  assert.equal(readFileSync(raced.log, "utf8").match(/supervisor: starting/g).length, 2, "two supervisors ever started (step 1 + this one)")
  await stopBackground()
  console.log("✓ two simultaneous starts make one server")

  // 4. a start failure: the app exits before it is ready (a preload kills only `next`)
  const preload = path.join(tmp, "fail-next.cjs")
  writeFileSync(preload, "if (/next[\\\\/]dist[\\\\/]bin[\\\\/]next$/.test(process.argv[1] || '')) { console.error('simulated boot failure'); process.exit(3) }\n")
  const failed = await runToExit(repoA, ["start"], { extraEnv: { NODE_OPTIONS: `--require ${preload}` } })
  assert.notEqual(failed.code, 0, failed.out)
  assert.ok(failed.out.includes("✗ VibeDoc could not start: the app exited with code 3 before it was ready"), failed.out)
  assert.ok(failed.out.includes("simulated boot failure"), "the log tail")
  const s4 = state()
  assert.equal(s4.state, "stopped")
  assert.equal(s4.lastError, "the app exited with code 3 before it was ready")
  assert.ok(!alive(s4.supervisorPid), "the supervisor is gone")
  console.log("✓ a failed start says why, exits", failed.code, "and server.json says stopped")
  const afterFail = await runToExit(repoA, ["status"])
  assert.equal(afterFail.code, 3, afterFail.out)
  assert.ok(afterFail.out.includes("  Last error: the app exited with code 3 before it was ready"), afterFail.out)
  const failJson = JSON.parse((await runToExit(repoA, ["status", "--json"])).out)
  assert.deepEqual([failJson.running, failJson.mode, failJson.state], [false, null, "stopped"])
  console.log("✓ status after a failed start shows the last error")

  // 5. S4: stop ends VibeDoc and the agent workers it started; the worker comes back Interrupted with Resume
  const workRepo = path.join(tmp, "work-repo")
  mkdirSync(path.join(workRepo, "plans/roadmap"), { recursive: true })
  mkdirSync(path.join(workRepo, "plans/tasks"), { recursive: true })
  mkdirSync(path.join(workRepo, ".vibedoc"), { recursive: true })
  writeFileSync(path.join(workRepo, ".vibedoc/feedback.json"), JSON.stringify({ consent: false, sent: [] }))
  writeFileSync(path.join(workRepo, ".vibedoc/settings.json"), JSON.stringify({ workers: { env: ["CLAUDE_STUB_WORKER_MS"], verify: false } }))
  writeFileSync(path.join(workRepo, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
  for (const [epicId, taskId] of [["R002", "T001"], ["R003", "T002"], ["R004", "T003"], ["R005", "T004"]]) {
    writeFileSync(path.join(workRepo, `plans/roadmap/${epicId}-epic.md`), `# ${epicId}: Epic ${epicId}\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** ${taskId}\n`)
    writeFileSync(path.join(workRepo, `plans/tasks/${taskId}-task.md`), `# ${taskId}: Task ${taskId}\n**Status:** todo\n**Phase:** ${epicId}\n\n## Goal\nWrite ${taskId}.txt\n`)
  }
  const git = (...a) => execFileSync("git", a, { cwd: workRepo, encoding: "utf8" })
  git("init", "-q", "-b", "main")
  git("add", "-A")
  git("-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init")
  const stubPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "claude-stub")
  const workEnv = { PATH: `${stubPath}${path.delimiter}${process.env.PATH}`, CLAUDE_STUB_WORKER_MS: "120000" }
  const q = `?root=${encodeURIComponent(workRepo)}`
  const workerProc = (id) => {
    const dir = path.join(home, "worktrees")
    for (const p of readdirSync(dir)) {
      try { return JSON.parse(readFileSync(path.join(dir, p, ".vibedoc-workers", `${id}.json`), "utf8")) } catch {}
    }
    return null
  }
  /** Worker turns whose pid still lives, from every worker state file (what stop's sweep reads too). */
  const workerTurnsAlive = () => {
    const dir = path.join(home, "worktrees")
    const live = []
    for (const p of readdirSync(dir)) {
      let files = []
      try { files = readdirSync(path.join(dir, p, ".vibedoc-workers")).filter((f) => f.endsWith(".json")) } catch {}
      for (const f of files) {
        const s = JSON.parse(readFileSync(path.join(dir, p, ".vibedoc-workers", f), "utf8"))
        if (alive(s.pid)) live.push(s.id ?? f)
      }
    }
    return live
  }
  const workerChat = (id) => JSON.parse(readFileSync(path.join(workRepo, ".vibedoc/chats", `${id}.json`), "utf8"))
  async function startWorker(epicId, taskId) {
    const res = await fetch(`${url}/api/workers${q}`, { method: "POST", headers: { "content-type": "application/json", origin: url }, body: JSON.stringify({ target: { kind: "epic", id: epicId } }) })
    const w = await res.json()
    assert.equal(res.status, 200, JSON.stringify(w))
    await until(`${taskId}'s stub to run`, () => workerProc(w.id)?.taskId === taskId && alive(workerProc(w.id).pid), 60_000)
    stubPids.add(workerProc(w.id).pid)
    return { id: w.id, pid: workerProc(w.id).pid }
  }

  const s5 = await runToExit(workRepo, ["start"], { extraEnv: workEnv })
  assert.equal(s5.code, 0, s5.out)
  // only the CLI on this machine may ask for a shutdown
  const shutdown = (headers) => fetch(`${url}/api/server/shutdown`, { method: "POST", headers }).then((r) => r.status)
  assert.equal(await shutdown({}), 403, "no header → 403")
  assert.equal(await shutdown({ "x-vibedoc-cli": "1", origin: "http://evil.example" }), 403, "another origin → 403")
  assert.equal(await shutdown({ origin: url }), 403, "the app's own origin without the header → 403")
  console.log("✓ /api/server/shutdown refuses without the CLI header or from another origin (403)")

  const w1 = await startWorker("R002", "T001")
  const s5state = state()
  const stop = await runToExit(repoA, ["stop"])
  assert.equal(stop.code, 0, stop.out)
  assert.ok(stop.out.includes("Stopped 1 agent run (R002). It shows as Interrupted with Resume next time."), stop.out)
  assert.ok(stop.out.includes("✓ VibeDoc stopped"), stop.out)
  for (const [pid, what] of [[s5state.supervisorPid, "supervisor"], [s5state.serverPid, "server"], [w1.pid, "worker stub"]]) assert.equal(alive(pid), false, `the ${what} is gone`)
  assert.equal(await answers(PORT), 0, "nothing answers")
  if (process.platform !== "win32") assert.equal(listeners(PORT), 0, "the port is free")
  assert.equal(state().state, "stopped")
  assert.equal((await runToExit(repoA, ["status"])).code, 3, "status: not running")
  console.log(`✓ stop ends the supervisor, the server and the worker's turn in ${stop.ms} ms; status exits 3`)

  // after the next start the worker shows as Interrupted with Resume (T556 adopts the dead turn)
  assert.equal((await runToExit(workRepo, ["start"], { extraEnv: workEnv })).code, 0)
  await fetch(`${url}/api/conversations${q}`)
  await until("the worker to be interrupted", () => workerChat(w1.id).worker.phase === "wait-user", 15_000)
  const t1 = workerChat(w1.id).worker.turns[0]
  assert.deepEqual([t1.taskId, t1.result], ["T001", "interrupted"])
  console.log("✓ after the next start the stopped worker is Interrupted (waits for Resume)")

  // a hung server (SIGSTOP): stop still ends everything through the sweep, within 15 s
  const w2 = await startWorker("R003", "T002")
  const hung = state()
  if (process.platform !== "win32") {
    process.kill(hung.serverPid, "SIGSTOP")
    const hungStop = await runToExit(repoA, ["stop"], { timeoutMs: 30_000 })
    assert.equal(hungStop.code, 0, hungStop.out)
    assert.ok(hungStop.ms < 15_000, `within 15 s (took ${hungStop.ms} ms)`)
    assert.ok(hungStop.out.includes("did not answer within 5 s"), hungStop.out)
    assert.ok(hungStop.out.includes("Stopped 1 agent run (T002)"), hungStop.out)
    for (const [pid, what] of [[hung.supervisorPid, "supervisor"], [hung.serverPid, "server"], [w2.pid, "worker stub"]]) assert.equal(alive(pid), false, `the ${what} is gone`)
    assert.equal(listeners(PORT), 0, "the port is free")
    console.log(`✓ a hung server: stop sweeps the supervisor tree and the worker turn in ${hungStop.ms} ms`)
  } else {
    assert.equal((await runToExit(repoA, ["stop"])).code, 0)
  }

  // 6. S5: a crash comes back at the same address; the worker running through it keeps running
  const s6 = await runToExit(workRepo, ["start"], { extraEnv: workEnv })
  assert.equal(s6.code, 0, s6.out)
  const mcpUrl = `${url}/api/mcp${q}`
  assert.ok(await mcpCall(mcpUrl, "vibedoc_get_status"))
  const w3 = await startWorker("R004", "T003")
  const before = state()
  const crashedAt = Date.now()
  crash(before.serverPid)
  await until("the app to answer again with a new server", async () => {
    const s = state()
    return s?.state === "running" && s.serverPid && s.serverPid !== before.serverPid && (await answers(PORT)) === 200
  }, 10_000)
  const back = Date.now() - crashedAt
  const s6after = state()
  assert.equal(s6after.port, PORT, "same port")
  assert.equal(s6after.supervisorPid, before.supervisorPid, "same supervisor")
  assert.equal(s6after.restarts.length, 1)
  if (process.platform !== "win32") assert.equal(s6after.restarts[0].signal, "SIGKILL")
  assert.ok(readFileSync(s6after.log, "utf8").includes("restarting in 1 s"), "the log says it restarts")
  assert.ok(await mcpCall(mcpUrl, "vibedoc_get_status"), "the MCP URL works after the crash")
  // the worker's turn outlived the crash and its chat still follows it (T556 adopts it on the next request)
  await fetch(`${url}/api/conversations${q}`)
  assert.equal(alive(w3.pid), true, "the worker's turn is still running")
  const w3chat = workerChat(w3.id).worker
  assert.equal(w3chat.phase, "running", JSON.stringify(w3chat))
  assert.equal(w3chat.turns.at(-1).taskId, "T003")
  assert.equal(w3chat.turns.at(-1).result ?? null, null, "the turn hasn't ended")
  assert.equal(workerProc(w3.id).pid, w3.pid)
  console.log(`✓ after a SIGKILL VibeDoc answers again at ${url} in ${back} ms; MCP works and the worker kept running`)

  // 7. crash loop: 5 crashes within 60 s → the supervisor gives up, status says why
  for (let killed = before.serverPid, n = 0; n < 6; n++) {
    await until("a new server or the supervisor to give up", () => !alive(before.supervisorPid) || (alive(state()?.serverPid) && state().serverPid !== killed), 15_000)
    if (!alive(before.supervisorPid)) break
    killed = state().serverPid
    crash(killed)
  }
  await until("the supervisor to give up", () => !alive(before.supervisorPid), 15_000)
  const s7 = state()
  assert.equal(s7.state, "crashed")
  assert.equal(s7.restarts.length, 5)
  assert.equal(s7.serverPid, null)
  assert.match(s7.lastError, /^the app exited with (signal SIGKILL|code \d+), 5 times in 60 s\n/)
  assert.ok(s7.lastError.split("\n").length > 2, "the log lines follow the reason")
  assert.equal(await answers(PORT), 0, "it stays down")
  const loopStatus = await runToExit(repoA, ["status"])
  assert.equal(loopStatus.code, 3, loopStatus.out)
  assert.ok(loopStatus.out.includes(`  Last error: ${s7.lastError.split("\n")[0]}`), loopStatus.out)
  assert.ok(loopStatus.out.includes("restarting in 4 s"), "the log lines are shown")
  assert.ok(loopStatus.out.includes(`  See the log: ${s7.log} · Start again: vibedoc start`), loopStatus.out)
  // the worker's turn is detached and outlives the supervisor; end it here (step 8 checks stop on its own)
  crash(w3.pid)
  console.log("✓ 5 crashes within 60 s: the supervisor gives up, status exits 3 with the last error and log lines")

  // 8. the epic's Done when: start, leave, use it from the browser and an agent, stop, nothing left
  const dw = await runToExit(workRepo, ["start"], { extraEnv: workEnv })
  assert.equal(dw.code, 0, dw.out)
  const printedMcp = dw.out.match(/MCP: +(\S+)/)?.[1]
  assert.equal(printedMcp, mcpUrl, "the printed MCP URL")
  const s8 = state()
  assert.deepEqual([s8.state, s8.restarts, s8.lastError], ["running", [], null], "a start after a crash loop starts fresh")
  assert.equal(await answers(PORT), 200, "the app answers after the parent exited")
  assert.ok((await fetch(`${url}/?root=${encodeURIComponent(workRepo)}`, { redirect: "manual" })).status < 400, "the browser page")
  assert.ok(await mcpCall(printedMcp, "vibedoc_get_status"), "the agent's MCP call")
  const w4 = await startWorker("R005", "T004")
  const dwStop = await runToExit(repoA, ["stop"])
  assert.equal(dwStop.code, 0, dwStop.out)
  for (const [pid, what] of [[s8.supervisorPid, "supervisor"], [s8.serverPid, "server"], [w4.pid, "worker"]]) assert.equal(alive(pid), false, `the ${what} is gone`)
  assert.deepEqual(workerTurnsAlive(), [], "no worker turn left")
  if (process.platform !== "win32") assert.equal(listeners(PORT), 0, "the port is free")
  assert.equal((await runToExit(repoA, ["status"])).code, 3)
  console.log("✓ Done when: start → the browser and an agent use it → stop leaves nothing running")
} finally {
  for (const child of children) child.kill("SIGTERM")
  const s = state()
  for (const pid of [s?.supervisorPid, s?.serverPid, ...stubPids]) if (pid && alive(pid)) process.kill(pid, "SIGKILL")
  rmSync(tmp, { recursive: true, force: true })
}
console.log("background-mode: ok")
