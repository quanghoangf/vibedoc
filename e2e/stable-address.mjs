// End-to-end check for R080's Done when: stop and restart `vibedoc` in the same project, and the MCP URL an agent
// connected to keeps working with no reconfiguration.
//   1. Run 1 (`--port 3080`): read the printed MCP URL, `tools/list` answers.
//   2. Stop, run 2 with no `--port`: same printed MCP URL (S1), `tools/list` answers again.
//   3. A second `vibedoc` while run 2 is up: "already running", same URL, no second server.
//   4. Another program holds the port: run 3 moves, prints the changed MCP URL + reconnect commands (S2).
//
//   pnpm build && node e2e/stable-address.mjs      (PORT=3080 by default)
//
// Spawns the real bin with --no-open from the `.next` build. Writes only into a fresh mktemp project.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "vibedoc.mjs")
const PORT = Number(process.env.PORT || 3080)
const project = mkdtempSync(path.join(tmpdir(), "vibedoc-address-e2e-"))
const children = new Set()
let holder = null

/** Runs the bin until `until` matches its output (or it exits); returns { child, out, exited }. */
function run(args, until) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, "--no-open", ...args], { cwd: project })
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

async function toolsList(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.result.tools.length > 0, "tools/list returns tools")
}

try {
  const ready = /Press Ctrl\+C/

  const first = await run(["--port", String(PORT)], ready)
  const url = printedMcp(first.out)
  assert.equal(url, `http://localhost:${PORT}/api/mcp`)
  assert.ok(first.out.includes(`claude mcp add --transport http vibedoc ${url}`))
  await toolsList(url)
  await stop(first.child)
  assert.equal(readFileSync(path.join(project, ".vibedoc", "port"), "utf8").trim(), String(PORT))
  console.log("✓ run 1 serves", url)

  const second = await run([], ready)
  assert.equal(printedMcp(second.out), url, "S1: same MCP URL after a restart")
  await toolsList(url)
  console.log("✓ S1 restart keeps", url, "and tools/list still answers")

  const again = await run([], /already running/)
  if (!again.exited) await new Promise((r) => again.child.once("exit", r))
  assert.equal(again.child.exitCode, 0)
  assert.equal(printedMcp(again.out), url)
  assert.ok(!again.out.includes("Starting VibeDoc"), "no second server")
  await stop(second.child)
  console.log("✓ a second vibedoc reuses the running one")

  holder = createServer((_, res) => res.end("not vibedoc"))
  await new Promise((r) => holder.listen(PORT, r))
  const moved = await run([], ready)
  const newUrl = printedMcp(moved.out)
  assert.notEqual(newUrl, url)
  assert.ok(moved.out.includes(`Port ${PORT} (this project's usual address) is in use by another program`))
  assert.ok(moved.out.includes(`MCP URL changed to ${newUrl}`))
  assert.ok(moved.out.includes("claude mcp remove vibedoc"))
  assert.ok(moved.out.includes(`claude mcp add --transport http vibedoc ${newUrl}`))
  await toolsList(newUrl)
  await stop(moved.child)
  console.log("✓ S2 taken port moves to", newUrl, "and says how to reconnect")
} finally {
  for (const child of children) child.kill("SIGTERM")
  holder?.close()
  rmSync(project, { recursive: true, force: true })
}
console.log("stable-address: ok")
