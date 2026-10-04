// Browser check for T131 (R052 cross-agent memory), on a fixture project:
//   1. Two Claude Code memory files + a MEMORY.md index in the fixture's Claude Code folder. A preview through
//      vibedoc_import_memory shows 2 new and writes nothing.
//   2. apply: true → /memory lists both entries live (SSE); their files carry `**Source:** claude-code:<name>`.
//   3. Apply again → 2 unchanged, nothing written.
//   4. AGENTS.md has hand-written text. vibedoc_export_memory → the managed block lists both summaries and the
//      hand-written text is intact. A second export → unchanged.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/cross-agent-memory.mjs
//
// Uses the real routes (only /api/projects is stubbed); writes a fresh mktemp fixture and
// <config>/projects/<slug(realpath(fixture))>/memory (config = $CLAUDE_CONFIG_DIR or ~/.claude, same as the server),
// which the finally removes. The mktemp root makes the slug unique, so real memory is never touched.
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const claudeProject = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude"), "projects", realpathSync(fx).replace(/[^a-zA-Z0-9]/g, "-"))
const claudeDir = path.join(claudeProject, "memory")
const entriesDir = path.join(fx, "memory/entries")
const agentsFile = path.join(fx, "AGENTS.md")
const handWritten = "# Agents\n\nHand-written: run pnpm, never npm.\n"
const listEntries = () => (existsSync(entriesDir) ? readdirSync(entriesDir).filter((f) => f.endsWith(".md")).sort() : [])

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

assert.equal(existsSync(claudeProject), false, `${claudeProject} already exists`) // never remove a folder we did not make
let browser
const errors = []
try {
  mkdirSync(claudeDir, { recursive: true })
  writeFileSync(path.join(claudeDir, "MEMORY.md"), "- [Pnpm only](pnpm_only.md) — package manager\n- [Terse answers](terse.md) — style\n")
  writeFileSync(path.join(claudeDir, "pnpm_only.md"), "---\nname: pnpm_only\ndescription: Use pnpm, the npm lockfile conflicts\ntype: project\n---\nnpm install fails on the lock conflict.\n")
  writeFileSync(path.join(claudeDir, "terse.md"), "---\nname: terse\ndescription: Keep answers short\ntype: feedback\n---\nCode first, at most three lines of prose.\n")
  writeFileSync(agentsFile, handWritten)

  browser = await launchChrome()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/memory`)
  const list = page.locator('section[aria-label="Knowledge entries"]')
  await list.waitFor()

  // 1. Preview: 2 new, nothing written
  const preview = await mcp("vibedoc_import_memory", { source: "claude-code" })
  assert.match(preview, /2 found in /, preview)
  assert.match(preview, /\+ new +decision +Use pnpm, the npm lockfile conflicts +\(pnpm_only\)/, preview)
  assert.match(preview, /\+ new +preference +Keep answers short +\(terse\)/, preview)
  assert.match(preview, /2 new · 0 update · 0 unchanged/, preview)
  assert.match(preview, /Call again with apply: true to write\./, preview)
  assert.deepEqual(listEntries(), [], "a preview writes nothing")
  assert.match(await mcp("vibedoc_import_memory", { source: "cursor" }), /Unknown source "cursor"/)
  console.log("ok  preview lists 2 new entries (MEMORY.md index skipped) and writes nothing")

  // 2. Apply → both entries live on /memory, with a Source line
  const applied = await mcp("vibedoc_import_memory", { source: "claude-code", apply: true })
  assert.match(applied, /Wrote 2 entries \(2 created · 0 updated\)\./, applied)
  await list.getByText("Use pnpm, the npm lockfile conflicts").waitFor({ timeout: 5000 }) // no reload: SSE
  await list.getByText("Keep answers short").waitFor()
  const files = listEntries()
  assert.equal(files.length, 2, files.join(", "))
  const raw = files.map((f) => readFileSync(path.join(entriesDir, f), "utf8")).join("\n")
  assert.match(raw, /\*\*Type:\*\* decision\n[\s\S]*\*\*Source:\*\* claude-code:pnpm_only\n/)
  assert.match(raw, /\*\*Type:\*\* preference\n[\s\S]*\*\*Source:\*\* claude-code:terse\n/)
  const ids = files.map((f) => f.slice(0, 4))
  assert.match(await mcp("vibedoc_get_entries", { ids }), /Source: claude-code:(pnpm_only|terse)[\s\S]*Source: claude-code:(pnpm_only|terse)/)
  console.log("ok  apply creates both entries with **Source:** claude-code:<name>; /memory lists them live")

  // 3. Apply again → unchanged
  const again = await mcp("vibedoc_import_memory", { source: "claude-code", apply: true })
  assert.match(again, /= unchanged +2\n/, again)
  assert.match(again, /Nothing to write\./, again)
  assert.equal(raw, listEntries().map((f) => readFileSync(path.join(entriesDir, f), "utf8")).join("\n"), "files untouched")
  console.log("ok  a second apply reports 2 unchanged and writes nothing")

  // 4. Export → managed block in AGENTS.md, hand-written text intact; again → unchanged
  assert.match(await mcp("vibedoc_export_memory", {}), /Exported 2 entries → AGENTS\.md \(updated\)$/)
  const agents = readFileSync(agentsFile, "utf8")
  assert.ok(agents.startsWith(handWritten + "\n<!-- vibedoc:entries:start -->\n"), agents)
  assert.match(agents, /### Decisions\n- Use pnpm, the npm lockfile conflicts: npm install fails on the lock conflict\. \(E00\d\)/)
  assert.match(agents, /### Preferences\n- Keep answers short: Code first, at most three lines of prose\. \(E00\d\)/)
  assert.ok(agents.endsWith("<!-- vibedoc:entries:end -->\n"), agents)
  assert.equal(existsSync(path.join(fx, "CLAUDE.md")), false, "CLAUDE.md is never created")
  assert.match(await mcp("vibedoc_export_memory", {}), /Exported 2 entries → AGENTS\.md \(unchanged\)$/)
  assert.equal(readFileSync(agentsFile, "utf8"), agents)
  console.log("ok  export writes both summaries into the AGENTS.md block, keeps the hand-written text; again → unchanged")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser?.close()
  rmSync(claudeProject, { recursive: true, force: true })
  assert.equal(existsSync(claudeProject), false, `${claudeProject} left behind`)
}
