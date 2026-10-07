// Check for R087 (agent-ready docs), on a fresh fixture project:
//   1. /md/<path> serves the doc as text/markdown, agent view (agent-only in, human-only out) (S2)
//   2. The page URL /docs?doc=<path> with Accept: text/markdown serves the same body (S2)
//   3. Paths outside the project, in dot-folders or not .md are refused, never read (S3)
//   4. A wrong path on /md/ or vibedoc_read_doc names up to 5 similar docs, the right one first (S3)
//   5. /llms.txt: title, doc sections with /md/ links + registry descriptions, specs, open epics; ?section=; no llms-full.txt (S1)
//   6. vibedoc_read_doc starts with a context line (path, priority, last edit, inbound links); off with docs.agentHeader: false (S5)
//   7. Browser: ⋯ on a doc → Copy page puts the agent view on the clipboard; View as Markdown / Copy agent link
//      point at /md/; Ask agent about this doc starts a chat that reads it; ⌘K lists the four; the editor
//      toolbar inserts both blocks (S4)
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3187 pnpm dev   # then:
//   BASE=http://localhost:3187 PW_DIR=<dir with node_modules/playwright> node e2e/agent-ready-docs.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3187"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const write = (rel, body) => { mkdirSync(path.dirname(path.join(fx, rel)), { recursive: true }); writeFileSync(path.join(fx, rel), body) }

const GUIDE = [
  "# Setup guide", "", "Install the app.",
  "<!-- agent-only Run pnpm test before you propose edits. -->",
  "<!-- human-only:start -->", "Click the big green button.", "<!-- human-only:end -->",
  "Then read [the overview](../architecture/overview.md).", "",
].join("\n")
write("docs/guides/setup.md", GUIDE)
write("docs/architecture/overview.md", "---\npriority: P1\n---\n# Architecture overview\n\nSee `docs/guides/setup.md`.\n")
write("README.md", "# App\n\nStart with [the overview](docs/architecture/overview.md).\n")
write(".vibedoc/secret.md", "# secret\n")
write("notes.txt", "not a doc\n")
write("docs/specs/lists.md", "# Lists\n\n## Purpose\nHow lists behave.\n\n### Requirement: Create\nA list has a name.\n")
write("docs/REGISTRY.md", ["# Document Registry", "", "<!-- REGISTRY_ANNOTATIONS_START -->", "| Path | Description | Keywords |", "|------|-------------|----------|",
  "| docs/guides/setup.md | How to install and run the app | setup |", "<!-- REGISTRY_ANNOTATIONS_END -->", ""].join("\n"))

const get = (p, headers = {}) => fetch(`${BASE}${p}`, { headers })
async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

try {
  // 1. S2: /md/<path>
  let res = await get(`/md/docs/guides/setup.md${q}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/)
  const body = await res.text()
  assert.match(body, /Run pnpm test before you propose edits\./)
  assert.doesNotMatch(body, /big green button|human-only|agent-only/)
  assert.match(body, /^# Setup guide/)
  console.log("ok  S2: /md/<path> is text/markdown with agent-only notes and without human-only blocks")

  // 2. S2: content negotiation on the page URL
  res = await get(`/docs${q}&doc=${encodeURIComponent("docs/guides/setup.md")}`, { accept: "text/markdown" })
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/)
  assert.equal(await res.text(), body)
  res = await get(`/docs${q}&doc=${encodeURIComponent("docs/guides/setup.md")}`, { accept: "text/html" })
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/)
  console.log("ok  S2: /docs?doc= with Accept: text/markdown serves the doc; a browser still gets the page")

  // 3. S3: refusals
  // fetch normalises %2E%2E segments away before sending: whatever answers, it is never a file
  res = await get(`/md/%2E%2E/%2E%2E/%2E%2E/etc/hosts${q}`)
  assert.notEqual(res.status, 200)
  // an encoded slash keeps the escape inside one segment, so it reaches the route
  for (const bad of ["/md/docs%2F..%2F..%2Fsecret.md", "/md/.vibedoc/secret.md", "/md/.vibedoc/feedback.json", "/md/notes.txt", "/md/node_modules/x.md"]) {
    res = await get(`${bad}${q}`)
    const text = await res.text()
    assert.equal(res.status, 400, `${bad} refused (${res.status}: ${text})`)
    assert.match(text, /^Refused/)
  }
  res = await get(`/docs${q}&doc=${encodeURIComponent("../../etc/passwd.md")}`, { accept: "text/markdown" })
  assert.equal(res.status, 400)
  console.log("ok  S3: outside the project, dot-folders and non-.md paths are refused")

  // 4. S3: wrong path → suggestions
  res = await get(`/md/docs/archtecture-overvew.md${q}`)
  assert.equal(res.status, 404)
  let miss = await res.text()
  assert.match(miss, /^Doc not found: docs\/archtecture-overvew\.md\n\nDid you mean:\n- \/md\/docs\/architecture\/overview\.md\?root=/)
  assert.ok(miss.split("\n").filter((l) => l.startsWith("- ")).length <= 5)
  // the suggested link works as given
  const link = miss.match(/- (\/md\/\S+)/)[1]
  assert.equal((await get(link)).status, 200)
  miss = await mcp("vibedoc_read_doc", { query: "archtecture-overvew" })
  assert.match(miss, /Doc not found: "archtecture-overvew"\. Did you mean:\n- docs\/architecture\/overview\.md/)
  console.log("ok  S3: a wrong path on /md/ and vibedoc_read_doc names the right doc first, links work")

  // 5. S1: /llms.txt
  res = await get(`/llms.txt${q}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /^text\/plain/)
  const index = await res.text()
  assert.match(index, new RegExp(`^# ${path.basename(fx)}\\n`))
  assert.match(index, /- \[docs\/guides\/setup\.md\]\(http:\/\/[^)]+\/md\/docs\/guides\/setup\.md\?root=[^)]+\): How to install and run the app\n/)
  assert.match(index, /## Capability specs\n- \[Lists\]\([^)]+\/md\/docs\/specs\/lists\.md[^)]*\): How lists behave\./)
  assert.match(index, /## Open epics\n- \[R002: Epic\]\([^)]+\/md\/plans\/roadmap\/R002-epic\.md[^)]*\): planned/)
  assert.doesNotMatch(index, /R001: Now/, "horizons are not epics")
  assert.doesNotMatch(index, /\.vibedoc|llms-full/)
  // every link in it fetches
  for (const [, url] of index.matchAll(/\]\((http[^)]+)\)/g)) assert.equal((await fetch(url)).status, 200, url)
  const section = await (await get(`/llms.txt${q}&section=other`)).text()
  assert.match(section, /## other\n/)
  assert.doesNotMatch(section, /Capability specs|Open epics/)
  assert.equal((await get(`/llms-full.txt${q}`)).status, 404)
  console.log("ok  S1: /llms.txt lists doc sections with descriptions, specs and open epics; every link fetches; ?section= narrows; no llms-full.txt")

  // 6. S5: context header
  let read = await mcp("vibedoc_read_doc", { query: "docs/architecture/overview.md" })
  assert.match(read.split("\n")[0], /^> docs\/architecture\/overview\.md · P1 · 2 inbound links · propose edits with vibedoc_propose_edit$/)
  // an edit shows up as the last edit
  assert.equal((await fetch(`${BASE}/api/docs${q}`, { method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "docs/architecture/overview.md", edits: [{ old_string: "See", new_string: "Read" }], actor: "ai" }) })).status, 200)
  read = await mcp("vibedoc_read_doc", { query: "docs/architecture/overview.md" })
  assert.match(read.split("\n")[0], /^> docs\/architecture\/overview\.md · P1 · edited \d{4}-\d\d-\d\d by ai · 2 inbound links · /)
  writeFileSync(path.join(fx, ".vibedoc/settings.json"), JSON.stringify({ docs: { agentHeader: false } }))
  read = await mcp("vibedoc_read_doc", { query: "docs/architecture/overview.md" })
  assert.match(read, /^## docs\/architecture\/overview\.md\n/)
  console.log("ok  S5: vibedoc_read_doc starts with path · priority · last edit · inbound links; gone with docs.agentHeader: false")

  // 7. S4: page actions in the browser
  writeFileSync(path.join(fx, ".vibedoc/settings.json"), "{}")
  const browser = await launchChrome()
  const errors = []
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] })
    const page = await context.newPage()
    page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
    page.on("pageerror", (e) => errors.push(e.message))
    const calls = await stubChat(page, [{ type: "result", is_error: false, session_id: "s1" }], { root: fx })
    const doc = "docs/guides/setup.md"
    await page.goto(`${BASE}/docs?doc=${encodeURIComponent(doc)}`)
    await page.getByText("Install the app.").first().waitFor()
    const menu = () => page.getByRole("button", { name: `Actions for ${doc}` }).first()

    await menu().click()
    await page.getByRole("menuitem", { name: "Copy page" }).click()
    await page.getByText("Copied the page as an agent reads it").waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), body)
    console.log("ok  S4: Copy page puts the agent view on the clipboard (human-only removed, agent note in)")

    await menu().click()
    await page.getByRole("menuitem", { name: "Copy agent link" }).click()
    const agentLink = await page.evaluate(() => navigator.clipboard.readText())
    assert.equal(agentLink, `${BASE}/md/docs/guides/setup.md${q}`)
    assert.equal(await (await fetch(agentLink)).text(), body)
    await menu().click()
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("menuitem", { name: "View as Markdown" }).click()])
    assert.equal(popup.url(), agentLink)
    await popup.close()
    console.log("ok  S4: Copy agent link / View as Markdown use the /md/ URL an agent fetches")

    await page.keyboard.press("ControlOrMeta+k")
    const list = page.getByRole("listbox")
    for (const name of ["Copy page", "View as Markdown", "Copy agent link", "Ask agent about this doc"]) {
      await list.getByRole("option", { name: new RegExp(`^${name}`) }).waitFor()
    }
    await page.keyboard.press("Escape")
    await list.waitFor({ state: "hidden" })
    console.log("ok  S4: ⌘K on an open doc lists Copy page, View as Markdown, Copy agent link, Ask agent about this doc")

    await menu().click()
    await page.getByRole("menuitem", { name: "Ask agent about this doc" }).click()
    for (let i = 0; i < 50 && !calls.length; i++) await page.waitForTimeout(100)
    assert.ok(calls.length, "a chat turn was sent")
    assert.match(JSON.stringify(calls[0]), /docs\/guides\/setup\.md.*vibedoc_read_doc/)
    console.log("ok  S4: Ask agent about this doc starts a chat that reads the doc with vibedoc_read_doc")

    // the editor toolbar inserts both blocks
    await page.goto(`${BASE}/docs?doc=${encodeURIComponent(doc)}`)
    await page.getByRole("tab", { name: "Edit" }).click()
    const editor = page.getByRole("textbox").filter({ hasText: "Install the app." })
    await editor.getByText("Install the app.").click()
    await page.keyboard.press("End")
    await page.keyboard.type(" note")
    await page.keyboard.press("Shift+Home")
    await page.getByRole("button", { name: "Agent-only note" }).click()
    await editor.getByText("<!-- agent-only").nth(1).waitFor()
    await page.getByRole("button", { name: "Human-only block" }).click()
    const lines = (await editor.innerText()).split("\n")
    const at = lines.indexOf("Install the app. note")
    assert.deepEqual(lines.slice(at - 2, at + 3), ["<!-- agent-only", "<!-- human-only:start -->", "Install the app. note", "<!-- human-only:end -->", "-->"], lines.join("\n"))
    console.log("ok  S4: the editor toolbar inserts an agent-only note and a human-only block")
    assert.deepEqual(errors, [], `console errors:\n${errors.join("\n")}`)
  } finally {
    await browser.close()
  }
} finally {
  rmSync(fx, { recursive: true, force: true })
}
