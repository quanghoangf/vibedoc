// Shared group memory (R103): a group-scoped entry in one repo reaches the other repos of its group over MCP.
//
//   export VIBEDOC_HOME=$(mktemp -d)
//   PORT=3131 pnpm dev:next                                    # the server, with a throwaway hub
//   BASE=http://localhost:3131 PW_DIR=<dir with node_modules/playwright> node e2e/group-memory.mjs
//
// T541 = MCP: session start, recall, related memory, get_entries, save_entry scope. T542 = the Memory tab: scope chips,
// the owning project on shared rows, an edit that lands in the owner repo, the scope switch.
//
// Writes only into fresh mktemp fixture projects and the temp hub, never this repo or ~/.vibedoc.
// S3 compares a project in no group with e2e/fixtures/group-memory/solo-read-memory.txt, captured before R103
// (WRITE_SNAPSHOT=1 rewrites it: only do that on purpose).
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { launchChrome, registerProject, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/group-memory/solo-read-memory.txt")

/** `<tmp>/<name>` (so the hub id is the name), MEMORY.md with no ids or dates, entries without **Updated:** (never stale). */
function project(name, entries = [], settings = null) {
  const root = path.join(mkdtempSync(path.join(tmpdir(), "vibedoc-e2e-")), name)
  mkdirSync(path.join(root, "memory/entries"), { recursive: true })
  mkdirSync(path.join(root, "plans/tasks"), { recursive: true })
  mkdirSync(path.join(root, ".vibedoc"), { recursive: true })
  writeFileSync(path.join(root, ".vibedoc/feedback.json"), JSON.stringify({ consent: false, sent: [] }))
  writeFileSync(path.join(root, "memory/MEMORY.md"), `# Project Memory\n\n## Current state\nThe ${name} repo.\n\n## Handoff for next session\nNothing open.\n`)
  for (const [file, text] of entries) writeFileSync(path.join(root, "memory/entries", file), text)
  if (settings) writeFileSync(path.join(root, ".vibedoc/settings.json"), JSON.stringify(settings, null, 2))
  return { root, ...registerProject(root) }
}

async function mcp(p, name, args = {}) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(p.root)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const data = await res.json()
  assert.ok(!data.error, `${name} → ${JSON.stringify(data.error)}`)
  return { text: data.result.content[0].text, isError: !!data.result.isError }
}

// a fresh slug per run: an older run's projects in the same hub never join this group
const slug = `shop-${Date.now().toString(36)}`
const group = { groups: [slug], groupNames: { [slug]: "Shop" } }
const soloEntries = [
  ["E001-api-errors-use-the-error-envelope.md", "# E001: API errors use the error envelope\n**Type:** convention\n\nEvery route answers `{ error: { message } }` on failure.\n"],
  ["E002-retry-flaky-uploads-once.md", "# E002: Retry flaky uploads once\n**Type:** gotcha\n\nThe storage API drops the first request after idle.\n"],
]

// ── S3: a project in no group reads exactly what it read before R103 (one call: a second one could add an episode)
const solo = project("solo", soloEntries)
const soloText = (await mcp(solo, "vibedoc_read_memory")).text
if (process.env.WRITE_SNAPSHOT === "1") {
  writeFileSync(SNAPSHOT, soloText)
  console.log(`wrote ${SNAPSHOT}`)
  process.exit(0)
}
assert.equal(soloText, readFileSync(SNAPSHOT, "utf8"))
console.log("ok  S3 a project in no group: vibedoc_read_memory is byte-for-byte the pre-R103 snapshot")

const solo2 = project("solo2")
const refused = await mcp(solo2, "vibedoc_save_entry", { type: "convention", summary: "Nope", scope: "group" })
assert.ok(refused.isError && /no group/i.test(refused.text), refused.text)
console.log("ok  save_entry scope: group in a project in no group is refused")

// ── S1 / S2: api and web in one group
const api = project("api", [["E001-local-build-cache-lives-in-tmp.md", "# E001: Local build cache lives in tmp\n**Type:** gotcha\n\nOnly this repo's build uses it.\n"]], group)
const web = project("web", [], group)
const A = api.id // "api", or "api-2" when an older run left one in this hub

const saved = await mcp(api, "vibedoc_save_entry", { type: "convention", summary: "Money is integer cents everywhere", body: "Never floats on the wire.", scope: "group" })
assert.ok(!saved.isError && /E002/.test(saved.text), saved.text)
assert.match(readFileSync(path.join(api.root, "memory/entries/E002-money-is-integer-cents-everywhere.md"), "utf8"), /^\*\*Scope:\*\* group$/m)
console.log("ok  save_entry scope: group writes **Scope:** group into api's own entry file")

const webMemory = (await mcp(web, "vibedoc_read_memory")).text
const sharedLine = `${A}:E002 (shared · ${A}) · convention · Money is integer cents everywhere`
assert.ok(webMemory.split("\n").some((l) => l.startsWith(sharedLine)), webMemory)
assert.match(webMemory, /## Knowledge entries \(1\)/)
console.log("ok  S1 the next vibedoc_read_memory in web lists api's group entry, marked shared")

assert.doesNotMatch(webMemory, /build cache/i)
const webRecallLocal = (await mcp(web, "vibedoc_recall", { query: "build cache" })).text
assert.match(webRecallLocal, /^No entries match/)
const hidden = (await mcp(web, "vibedoc_get_entries", { ids: [`${A}:E001`] })).text
assert.ok(hidden.includes(`Not found: ${A}:E001`), hidden)
console.log("ok  S2 api's project-scope entry is absent from web's session, recall and get_entries")

const recall = (await mcp(web, "vibedoc_recall", { query: "money cents" })).text
assert.ok(recall.includes(sharedLine), recall)
const body = (await mcp(web, "vibedoc_get_entries", { ids: [`${A}:E002`] })).text
assert.ok(body.includes(`## ${sharedLine}`), body)
assert.match(body, /Never floats on the wire\./)
console.log("ok  web recall finds the shared entry; get_entries api:E002 returns its body")

const apiMemory = (await mcp(api, "vibedoc_read_memory")).text
assert.match(apiMemory, /^E002 · convention · Money is integer cents everywhere/m)
assert.doesNotMatch(apiMemory, /shared ·/)
console.log("ok  in api its own group entry is listed as its own, not as shared")

writeFileSync(path.join(web.root, "plans/tasks/T001-price-display.md"), "# T001: Show money as integer cents in the cart\n**Status:** todo\n\n## Goal\nPrices in cents.\n")
const task = (await mcp(web, "vibedoc_get_task", { taskId: "T001" })).text
assert.ok(/## Related memory\n/.test(task) && task.includes(sharedLine), task)
console.log("ok  a web task's ## Related memory lists the shared entry")

// Flip back to project scope: web stops seeing it
await mcp(api, "vibedoc_save_entry", { id: "E002", type: "convention", summary: "Money is integer cents everywhere", scope: "project" })
assert.doesNotMatch(readFileSync(path.join(api.root, "memory/entries/E002-money-is-integer-cents-everywhere.md"), "utf8"), /Scope/)
assert.match((await mcp(web, "vibedoc_recall", { query: "money cents" })).text, /^No entries match/)
console.log("ok  scope: project removes the **Scope:** line and web no longer finds it")

// ── T542: the Memory tab in web
const moneyFile = (slugPart) => path.join(api.root, "memory/entries", `E002-${slugPart}.md`)
await mcp(api, "vibedoc_save_entry", { id: "E002", type: "convention", summary: "Money is integer cents everywhere", body: "Never floats on the wire.", scope: "group" })
const errors = []
const browser = await launchChrome()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  const list = page.locator('section[aria-label="Knowledge entries"]')
  const scopeChips = page.getByRole("group", { name: "Filter by scope" })

  // a project in no group: no scope chips
  await stubChat(page, [], { root: solo.root })
  await page.goto(`${BASE}/memory`)
  await list.getByText("Retry flaky uploads once").waitFor()
  assert.equal(await scopeChips.count(), 0)
  console.log("ok  T542 a project in no group: /memory has no scope filter")

  await page.unrouteAll({ behavior: "ignoreErrors" })
  await stubChat(page, [], { root: web.root })
  await page.goto(`${BASE}/memory`)
  await scopeChips.waitFor()
  await scopeChips.getByRole("button", { name: /^Shared/ }).click()
  const row = list.getByRole("button", { name: /Money is integer cents everywhere/ })
  await row.waitFor()
  assert.equal(await row.locator(`[data-shared-from="${A}"]`).innerText(), "api")
  assert.equal(await list.getByText("Local build cache lives in tmp").count(), 0)
  console.log("ok  T542 web's Shared chip lists api's group entry labelled api; api's project entry is absent")

  await row.click()
  await page.waitForURL(new RegExp(`entry=${A}%3AE002|entry=${A}:E002`))
  const detail = page.locator(`section[aria-label="${A}:E002"]`)
  await detail.getByText("Shared with the group").waitFor()
  await detail.getByRole("button", { name: "Edit" }).click()
  await page.getByLabel("Summary (one line)").fill("Money is integer cents on every wire")
  await page.getByRole("button", { name: "Save" }).click()
  await detail.getByText("Money is integer cents on every wire").first().waitFor()
  assert.ok(!existsSync(moneyFile("money-is-integer-cents-everywhere")))
  const edited = readFileSync(moneyFile("money-is-integer-cents-on-every-wire"), "utf8")
  assert.match(edited, /^# E002: Money is integer cents on every wire$/m)
  assert.match(edited, /^\*\*Scope:\*\* group$/m)
  assert.match(edited, /^\*\*By:\*\* human$/m)
  assert.equal(readdirSync(path.join(web.root, "memory/entries")).length, 0)
  console.log("ok  T542 editing the shared entry in web rewrites api's file, scope kept; nothing written in web")

  await detail.getByRole("button", { name: "Keep in this project" }).click()
  await detail.waitFor({ state: "detached" })
  await page.reload()
  await list.getByText("Money is integer cents on every wire").waitFor({ state: "detached" })
  assert.doesNotMatch(readFileSync(moneyFile("money-is-integer-cents-on-every-wire"), "utf8"), /Scope/)
  assert.match((await mcp(web, "vibedoc_recall", { query: "money cents" })).text, /^No entries match/)
  console.log("ok  T542 Keep in this project rewrites api's **Scope:** line; web no longer lists it")
  assert.deepEqual(errors, [])
  console.log("ok  no console errors")
} finally {
  await browser.close()
}

console.log("\nall group-memory checks passed")
