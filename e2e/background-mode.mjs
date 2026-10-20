// End-to-end check for background mode (R109): `vibedoc start` hands the terminal back while VibeDoc keeps serving.
//   1. S1: `vibedoc start --no-open` in repo A exits 0 within 60 s, prints the address, and the app still answers;
//      <home>/server.json says running with a live supervisor.
//   2. S2: `start` again in A and in repo B: exit 0, same address, same supervisorPid, one listener on the port, B in
//      /api/projects.
//   3. Plain `vibedoc` still runs in the foreground and Ctrl+C stops it.
//   4. A start failure (the app exits before it is ready) prints the reason + log tail, exits non-zero, and
//      server.json says stopped with lastError.
//
//   pnpm build && node e2e/background-mode.mjs      (PORT=3090 by default)
//
// Spawns the real bin with --no-open from the `.next` build, with its own temp VIBEDOC_HOME (never ~/.vibedoc).
// Later tasks (status, stop, crash restart) extend it.
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const state = (h = home) => { try { return JSON.parse(readFileSync(path.join(h, "server.json"), "utf8")) } catch { return null } }
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

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

/** Stops the background VibeDoc the way T571's `stop` will: SIGTERM to the supervisor, which stops the app. */
async function stopBackground(h = home) {
  const s = state(h)
  if (s?.supervisorPid && alive(s.supervisorPid)) process.kill(s.supervisorPid, "SIGTERM")
  await until("the supervisor to stop", () => !s?.supervisorPid || !alive(s.supervisorPid))
  if (s?.serverPid && alive(s.serverPid)) process.kill(s.serverPid, "SIGKILL")
  await until("the port to free", async () => (await answers(PORT)) === 0)
}

try {
  const url = `http://localhost:${PORT}`

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
  const fg = spawn(process.execPath, [bin, "--no-open"], { cwd: repoA, env: env() })
  children.add(fg)
  let fgOut = ""
  fg.stdout.on("data", (d) => { fgOut += d })
  fg.stderr.on("data", (d) => { fgOut += d })
  await until("the foreground server", () => fgOut.includes("Press Ctrl+C"), 60_000)
  assert.equal(fg.exitCode, null, "foreground keeps running")
  assert.equal(await answers(PORT), 200)
  fg.kill("SIGINT")
  await until("the foreground to exit", () => fg.exitCode !== null)
  await until("the port to free after Ctrl+C", async () => (await answers(PORT)) === 0)
  console.log("✓ plain vibedoc still runs in the foreground and Ctrl+C stops it")

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
} finally {
  for (const child of children) child.kill("SIGTERM")
  const s = state()
  for (const pid of [s?.supervisorPid, s?.serverPid]) if (pid && alive(pid)) process.kill(pid, "SIGKILL")
  rmSync(tmp, { recursive: true, force: true })
}
console.log("background-mode: ok")
