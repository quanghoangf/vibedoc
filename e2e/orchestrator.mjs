// Check for R108 T562: the orchestrator chat (ADR-007 decision 3).
//   1. A worker on R002 asks (T001 in .claude-stub-ask) and waits on the user → the server saves a note in the
//      orchestrator chat (.vibedoc/chats/orchestrator.json), created though nobody opened it.
//   2. Browser: the sidebar's "Ask the orchestrator" opens it; "Who is working on what? Propose a run on R005" → the
//      stub's turn starts with the note, runs with vibedoc_propose_run allowed, and the reply is built from
//      vibedoc_list_workers (S12); its propose_run draws the run card. Start worker → a worker on vibedoc/R005 (as the
//      epic sheet's button makes it) that finishes T005; its end is one more note, sent with the next turn.
//   3. The orchestrator is pinned on /chat, has no delete, Clear empties it and it is still there after a reload.
//      Fails on any browser console error.
//
// The server must run with e2e/fixtures/claude-stub first on PATH and the same VIBEDOC_HOME as this script:
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH VIBEDOC_HOME=$H PORT=3082 pnpm exec next start -p 3082   (after pnpm build)
//   VIBEDOC_HOME=$H BASE=http://localhost:3082 PW_DIR=<dir with node_modules/playwright> node e2e/orchestrator.mjs
// Writes only a fresh mktemp fixture and its worktrees under $VIBEDOC_HOME/worktrees (removed at the end).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3082"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const git = (args, cwd = fx) => execFileSync("git", args, { cwd, encoding: "utf8" })
const post = (url, body) => fetch(`${BASE}${url}${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const status = (id) => readFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), "utf8").match(/\*\*Status:\*\* (.+)/)[1]
  .toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/ /g, "-")
const savedChat = (id) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", `${id}.json`), "utf8"))
const savedChats = () => readdirSync(path.join(fx, ".vibedoc/chats")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", f), "utf8")))
const orchestratorCalls = () => existsSync(path.join(fx, ".claude-stub.log"))
  ? readFileSync(path.join(fx, ".claude-stub.log"), "utf8").split(/^(?=-p )/m).filter((c) => c.includes("project's orchestrator")) : []
async function until(fn, what, ms = 20000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

// Fixture: R002 (T001 asks) and R005 (T005); .claude-stub-ask is committed so the worktrees have it
const task = (id, epic) => writeFileSync(path.join(fx, "plans/tasks", `${id}-task.md`), `# ${id}: Task ${id}\n**Status:** todo\n**Phase:** ${epic}\n\n## Goal\nWrite ${id}.txt\n`)
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001\n")
writeFileSync(path.join(fx, "plans/roadmap/R005-other.md"), "# R005: Other\n**Parent:** R001\n**Status:** planned\n**Order:** 20\n**Tasks:** T005\n")
task("T001", "R002"); task("T005", "R005")
writeFileSync(path.join(fx, ".claude-stub-ask"), "T001\n")
writeFileSync(path.join(fx, ".gitignore"), ".claude-stub*.json\n.claude-stub.log\n")
git(["init", "-q", "-b", "main"])
git(["add", "-A"])
git(["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init"])
const { id: projectId } = registerProject(fx)

const dirs = []
try {
  // 1. a worker waits on the user → a note in the orchestrator chat, which nobody has opened
  const res = await post("/api/workers", { target: { kind: "epic", id: "R002" } })
  const w = await res.json()
  assert.equal(res.status, 200, JSON.stringify(w))
  dirs.push(w.dir)
  await until(() => savedChat(w.id).worker.phase === "wait-user", "the R002 worker waits on the user")
  await until(() => existsSync(path.join(fx, ".vibedoc/chats/orchestrator.json")), "the orchestrator chat is saved")
  const waitNote = "Worker vibedoc/R002 (R002) waits on you: T001: the agent stopped before the task was done."
  assert.deepEqual(savedChat("orchestrator").notes, [waitNote])
  assert.equal(savedChat("orchestrator").messages.length, 0)
  console.log("ok  a worker waiting on the user → a note in the orchestrator chat, created on the server")

  const browser = await launchChrome()
  const errors = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx.route("**/api/projects", (route) => route.fulfill({ json: [{ id: projectId, name: "fixture", root: fx, hasVibedoc: true }] }))
    const page = await ctx.newPage()
    page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(`${m.text()} ${m.location().url}`) })
    page.on("pageerror", (e) => errors.push(e.message))

    // 2. ask it from the sidebar: the reply comes from vibedoc_list_workers, propose_run draws the run card
    await page.goto(`${BASE}/board`)
    await page.getByRole("button", { name: "Ask the orchestrator" }).click()
    const pane = page.getByRole("region", { name: /Orchestrator/ })
    await pane.getByText("Who is working on what?").waitFor()
    const box = pane.getByPlaceholder("Ask the agent… (Enter to send)")
    await box.fill("Who is working on what? Propose a run on R005")
    await box.press("Enter")
    await pane.getByText("From vibedoc_list_workers").waitFor()
    await pane.getByText(new RegExp(`${w.id}.*R002.*wait-user`)).waitFor()
    const card = pane.getByRole("form", { name: "Work on R005 with an agent" })
    await card.getByText("New worktree").waitFor()
    assert.equal(await card.getByLabel("Branch").inputValue(), "vibedoc/R005")
    const [first] = orchestratorCalls()
    assert.ok(first.startsWith(`-p [${waitNote}]\n\nWho is working on what?`), `the note leads the turn: ${first.slice(0, 200)}`)
    assert.ok(!first.includes("mcp__vibedoc__vibedoc_propose_run"), "propose_run is allowed in the orchestrator chat")
    assert.ok(first.includes("--tools  --allowedTools mcp__vibedoc__*"), "no native tools")
    assert.deepEqual(savedChat("orchestrator").notes, [], "sent notes are cleared")
    console.log("ok  the reply is built from vibedoc_list_workers, the note led the turn, propose_run → a run card (S12)")

    // Accept starts the worker exactly like the epic sheet's button
    await card.getByRole("button", { name: "Start worker" }).click()
    await pane.getByText("Accepted: the worker took the run.").waitFor()
    await until(() => savedChats().some((c) => c.worker?.target.id === "R005"), "a worker on R005")
    const r5 = savedChats().find((c) => c.worker?.target.id === "R005")
    dirs.push(r5.worker.dir)
    assert.equal(r5.worker.branch, "vibedoc/R005")
    await until(() => savedChat(r5.id).worker.phase === "ended", "the R005 worker ends")
    assert.equal(status("T005"), "done")
    const endNote = "Worker vibedoc/R005 (R005) ended: Epic finished."
    await until(() => savedChat("orchestrator").notes.includes(endNote), "the end is a note")
    assert.ok(savedChat("orchestrator").notes.some((n) => n.startsWith(`User accepted the run for R005: worker ${r5.id} started`)))
    console.log("ok  Start worker → a worker on vibedoc/R005 finishes T005; its end is a note")

    // the next turn receives both notes
    await box.fill("Anything new?")
    await box.press("Enter")
    await until(() => orchestratorCalls().length === 2, "a second orchestrator turn")
    const second = orchestratorCalls()[1]
    assert.ok(second.includes(endNote) && second.includes("User accepted the run for R005"), `the next turn has the notes: ${second.slice(0, 300)}`)
    await pane.getByText(new RegExp(`${r5.id}.*R005.*ended`)).waitFor()
    console.log("ok  the next turn receives the worker's note")

    // 3. pinned on /chat, cleared not deleted, still there after a reload
    await page.goto(`${BASE}/chat?id=orchestrator`)
    const list = page.getByRole("complementary", { name: "All chats" })
    await list.getByText("Orchestrator", { exact: true }).first().waitFor()
    assert.equal(await list.getByRole("button", { name: /Close .*Orchestrator/ }).count(), 0, "no delete on the orchestrator")
    const main = page.getByRole("region", { name: /Orchestrator/ })
    await main.getByRole("button", { name: "Clear the orchestrator chat" }).click()
    await main.getByText("Who is working on what?").waitFor()
    await until(() => savedChat("orchestrator").messages.length === 0 && savedChat("orchestrator").sessionId === null, "the cleared chat is saved")
    await page.reload()
    await page.getByRole("region", { name: /Orchestrator/ }).getByText("Who is working on what?").waitFor()
    console.log("ok  /chat pins it, Clear empties it (no delete), a reload keeps it")
    assert.deepEqual(errors, [], `browser console errors: ${errors.join("\n")}`)
  } finally {
    await browser.close()
  }
} finally {
  for (const d of dirs) { try { git(["worktree", "remove", "--force", d]) } catch { rmSync(d, { recursive: true, force: true }) } }
  rmSync(fx, { recursive: true, force: true })
}
