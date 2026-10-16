// End-to-end check for the stable address (R080) on one hub (R100): every repo is served by one VibeDoc, each at its
// own MCP URL, and a restart keeps the URL an agent connected to.
//   1. Run 1 in repo A's package folder (`--port 3080`): the MCP URL is A's (`?root=`), `tools/list` answers, the port
//      is saved in <home>/port.
//   2. Stop, run 2 in A with no `--port`: same printed MCP URL, `tools/list` answers again.
//   3. `vibedoc` in repo B while run 2 is up: "already running", no second server, B joins /api/projects, the open
//      target is B, an open SSE stream gets `projects_updated`, A's MCP URL still answers.
//   4. `vibedoc` outside any repo while it runs: opens All projects. A cross-site POST /api/projects/add → 403.
//   5. Another program holds the port: run 3 moves, prints the changed MCP URL + reconnect commands.
//
//   pnpm build && node e2e/stable-address.mjs      (PORT=3080 by default)
//
// Spawns the real bin with --no-open from the `.next` build, with its own temp VIBEDOC_HOME (never ~/.vibedoc).
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "vibedoc.mjs")
const PORT = Number(process.env.PORT || 3080)
const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "vibedoc-address-e2e-")))
const home = path.join(tmp, "home")
const repo = (name) => {
  const dir = path.join(tmp, name)
  mkdirSync(path.join(dir, ".git"), { recursive: true })
  mkdirSync(path.join(dir, "packages", "web"), { recursive: true })
  return dir
}
const repoA = repo("repo-a"), repoB = repo("repo-b")
const loose = path.join(tmp, "loose")
mkdirSync(loose)
const children = new Set()
let holder = null
let events = null

/** Runs the bin in `cwd` until `until` matches its output (or it exits); returns { child, out, exited }. */
function run(cwd, args, until) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, VIBEDOC_HOME: home }
    delete env.VIBEDOC_ROOT
    const child = spawn(process.execPath, [bin, "--no-open", ...args], { cwd, env })
    children.add(child)
    let out = ""
    const timer = setTimeout(() => reject(new Error(`timed out; output:\n${out}`)), 90_000)
    const check = () => { if (until.test(out)) { clearTimeout(timer); resolve({ child, out, exited: false }) } }
    child.stdout.on("data", (d) => { out += d; check() })
    child.stderr.on("data", (d) => { out += d })
    child.on("exit", (code) => { children.delete(child); clearTimeout(timer); resolve({ child, out, exited: true, code }) })
  })
}

function stop(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    child.once("exit", () => resolve())
    child.kill("SIGTERM")
  })
}

const printedMcp = (out) => out.match(/MCP: +(\S+)/)?.[1]
const openTarget = (out) => out.match(/Open (\S+) in your browser/)?.[1]
const mcpFor = (port, root) => `http://localhost:${port}/api/mcp?root=${encodeURIComponent(root)}`
/** Processes listening on this port (Next renames its process title, so count listeners, not `next start`). */
const servers = (port) => {
  try { return new Set(execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)).size } catch { return 0 }
}

async function toolsList(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
  assert.equal(res.status, 200, `tools/list on ${url}`)
  const body = await res.json()
  assert.ok(body.result.tools.length > 0, "tools/list returns tools")
}

/** Collects the SSE stream's text until stopped. */
async function listen(port) {
  const ctrl = new AbortController()
  const res = await fetch(`http://localhost:${port}/api/events`, { signal: ctrl.signal })
  const state = { text: "", stop: () => ctrl.abort() }
  ;(async () => {
    const decoder = new TextDecoder()
    try { for await (const chunk of res.body) state.text += decoder.decode(chunk) } catch {}
  })()
  return state
}

try {
  const ready = /Press Ctrl\+C/
  const urlA = mcpFor(PORT, repoA)

  const first = await run(path.join(repoA, "packages", "web"), ["--port", String(PORT)], ready)
  assert.equal(printedMcp(first.out), urlA, "the package folder resolves to the repo root")
  assert.ok(first.out.includes(`claude mcp add --transport http vibedoc '${urlA}'`))
  await toolsList(urlA)
  await stop(first.child)
  assert.equal(readFileSync(path.join(home, "port"), "utf8").trim(), String(PORT))
  console.log("✓ run 1 serves", urlA)

  const second = await run(repoA, [], ready)
  assert.equal(printedMcp(second.out), urlA, "Restart: same MCP URL")
  await toolsList(urlA)
  console.log("✓ restart keeps", urlA, "and tools/list still answers")

  events = await listen(PORT)
  const b = await run(repoB, [], /in your browser/)
  if (!b.exited) await new Promise((r) => b.child.once("exit", r))
  assert.equal(b.child.exitCode, 0, b.out)
  assert.ok(!b.out.includes("Starting VibeDoc"), "no second server")
  assert.equal(servers(PORT), 1, "one server process")
  assert.equal(printedMcp(b.out), mcpFor(PORT, repoB))
  const projects = await (await fetch(`http://localhost:${PORT}/api/projects`)).json()
  const idB = projects.find((p) => p.root === repoB)?.id
  assert.ok(projects.some((p) => p.root === repoA) && idB, "both repos in the hub")
  assert.equal(openTarget(b.out), `http://localhost:${PORT}/?project=${encodeURIComponent(idB)}`, "browser target is B")
  for (let i = 0; i < 40 && !events.text.includes("projects_updated"); i++) await new Promise((r) => setTimeout(r, 50))
  assert.ok(events.text.includes("projects_updated"), "an open tab hears about B")
  await toolsList(urlA)
  await toolsList(mcpFor(PORT, repoB))
  console.log("✓ a second repo opens in the running hub; A's MCP URL unchanged")

  const out = await run(loose, [], /in your browser/)
  if (!out.exited) await new Promise((r) => out.child.once("exit", r))
  assert.equal(openTarget(out.out), `http://localhost:${PORT}/projects`)
  const evil = await fetch(`http://localhost:${PORT}/api/projects/add`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://evil.example", "x-vibedoc-cli": "1" },
    body: JSON.stringify({ root: loose }),
  })
  assert.equal(evil.status, 403, "cross-site add refused")
  const noHeader = await fetch(`http://localhost:${PORT}/api/projects/add`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ root: loose }) })
  assert.equal(noHeader.status, 403, "no Origin and no CLI header refused")
  events.stop()
  await stop(second.child)
  console.log("✓ outside a repo opens All projects; foreign adds refused")

  holder = createServer((_, res) => res.end("not vibedoc"))
  await new Promise((r) => holder.listen(PORT, r))
  const moved = await run(repoA, [], ready)
  const newUrl = printedMcp(moved.out)
  assert.notEqual(newUrl, urlA)
  assert.ok(moved.out.includes(`Port ${PORT} (this project's usual address) is in use by another program`))
  assert.equal(newUrl, mcpFor(Number(new URL(newUrl).port), repoA))
  assert.ok(moved.out.includes(`MCP URL changed to ${newUrl}`))
  assert.ok(moved.out.includes("claude mcp remove vibedoc"))
  assert.ok(moved.out.includes(`claude mcp add --transport http vibedoc '${newUrl}'`))
  await toolsList(newUrl)
  await stop(moved.child)
  console.log("✓ taken port moves to", newUrl, "and says how to reconnect")
} finally {
  events?.stop()
  for (const child of children) child.kill("SIGTERM")
  holder?.close()
  rmSync(tmp, { recursive: true, force: true })
}
console.log("stable-address: ok")
