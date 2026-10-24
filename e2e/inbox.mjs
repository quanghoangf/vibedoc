// T546: GET /api/inbox lists what waits on the user across every hub project, newest first.
// T547: ?group= keeps a project group's repos; /inbox lists them with filters in the URL, the header badge counts
// the whole inbox, and reviews are approved / sent back inline in their own repo, without opening the project.
// Critique round: the sidebar's Inbox row shows the same count; rows show their evidence in mono; Approve has Undo
// (the task file comes back byte for byte) and says what changed for the epic; j/k/a/s work; 390px keeps titles.
//
//   VIBEDOC_HOME=<tmp> PORT=3114 pnpm dev:next
//   VIBEDOC_HOME=<same tmp> BASE=http://localhost:3114 PW_DIR=<dir with node_modules/playwright> node e2e/inbox.mjs
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const inbox = async (q = "") => {
  const res = await fetch(`${BASE}/api/inbox${q}`)
  assert.equal(res.status, 200)
  return res.json()
}

// A: a task in review (hand-written, so no activity time); B: a chat whose last reply asks the user something
const a = makeFixture()
writeFileSync(path.join(a, "plans/tasks/T001-review.md"), "# T001: Alpha review\n**Status:** review\n**Phase:** R002\n")
const b = makeFixture()
mkdirSync(path.join(b, ".vibedoc/chats"), { recursive: true })
const now = new Date().toISOString()
writeFileSync(path.join(b, ".vibedoc/chats/c-bravo1.json"), JSON.stringify({
  id: "c-bravo1", title: "Bravo question", sessionId: null, busy: false, notes: [], attach: null, createdAt: now, updatedAt: now,
  messages: [{ role: "user", text: "plan it", questions: [], proposals: [], plans: [] },
    { role: "assistant", text: "Which one?", questions: [{ question: "Which one?" }], proposals: [], plans: [] }],
}))
const pa = registerProject(a)
const pb = registerProject(b)

const items = (await inbox()).filter((i) => i.project.id === pa.id || i.project.id === pb.id)
assert.deepEqual(items.map((i) => [i.kind, i.project.name, i.id]), [
  ["chat-waiting", pb.name, "c-bravo1"],
  ["review", pa.name, "T001"],
])
assert.equal(items[0].href, `/chat?id=c-bravo1&project=${encodeURIComponent(pb.id)}`)
console.log("ok  review in A and waiting chat in B, B's newer chat first, each with its project")

assert.deepEqual((await inbox(`?project=${encodeURIComponent(pa.id)}`)).map((i) => i.id), ["T001"])
console.log("ok  ?project= keeps one project")

// T547: A is in group "team"; an unknown group keeps nothing
writeFileSync(path.join(a, ".vibedoc/settings.json"), JSON.stringify({ groups: ["team"], groupNames: { team: "Team" } }))
assert.deepEqual((await inbox("?group=team")).map((i) => [i.project.id, i.id]), [[pa.id, "T001"]])
assert.deepEqual(await inbox("?group=nope"), [])
console.log("ok  ?group= keeps the group's repos, an unknown group nothing")

// A third repo with a review, and one in B, so three repos have something to clear
const c = makeFixture()
writeFileSync(path.join(c, "plans/tasks/T001-charlie.md"), "# T001: Charlie review\n**Status:** review\n**Phase:** R002\n")
writeFileSync(path.join(b, "plans/tasks/T002-bravo.md"), "# T002: Bravo review\n**Status:** review\n**Phase:** R002\n")
const pc = registerProject(c)
const status = (root, file) => readFileSync(path.join(root, "plans/tasks", file), "utf8").match(/\*\*Status:\*\* (.*)/)?.[1] ?? ""

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on("pageerror", (e) => errors.push(e.message))
  const row = (p, id) => page.locator(`[data-inbox-row="${p.id}/${id}"]`)

  // S1: while on project A, B's waiting chat is listed with B's name and the badge counts the whole inbox
  await page.goto(`${BASE}/inbox?project=${encodeURIComponent(pa.id)}`)
  await row(pb, "c-bravo1").waitFor()
  assert.match(await row(pb, "c-bravo1").innerText(), new RegExp(pb.name))
  const total = (await inbox()).length
  await page.waitForFunction((n) => document.querySelector("[data-inbox-count]")?.textContent === String(n), total)
  assert.match(await page.title(), new RegExp(`^\\(${total}\\) `))
  // one place: the sidebar's Inbox row carries no second count
  assert.equal(await page.locator("[data-sidebar-inbox-count]").count(), 0)
  console.log(`ok  S1: B's waiting chat shows on A with B's name; header badge and title count the whole inbox (${total}), the sidebar doesn't repeat it`)

  // Filters live in the URL (their own keys: ?project= is the open project)
  await page.getByRole("combobox", { name: "Kind" }).selectOption("chat-waiting")
  await page.waitForURL(/kind=chat-waiting/)
  assert.equal(await row(pa, "T001").count(), 0)
  await page.getByRole("combobox", { name: "Project" }).selectOption(pb.id)
  await page.waitForURL(/repo=/)
  await page.reload()
  await row(pb, "c-bravo1").waitFor()
  assert.equal(await page.locator("[data-inbox-row]").count(), 1)
  await page.getByRole("combobox", { name: "Kind" }).selectOption("")
  await page.getByRole("combobox", { name: "Project" }).selectOption("")
  console.log("ok  kind and project filters narrow the list and survive a reload")

  // Evidence in the row: these hand-written reviews have no checklist and no run, so Approve is the primary button
  assert.match(await row(pa, "T001").locator("[data-inbox-evidence]").innerText(), /no checks · no run/)
  assert.match(await row(pa, "T001").getByRole("button", { name: "Approve" }).getAttribute("class"), /bg-accent/)
  // The buttons' accessible names carry the task, so a screen reader's button list tells the rows apart
  assert.equal(await row(pa, "T001").getByRole("button", { name: /^Approve: T001 / }).count(), 1)
  assert.equal(await row(pa, "T001").getByRole("button", { name: /^Send back: T001 / }).count(), 1)
  console.log("ok  rows show their evidence (no checks · no run); Approve is primary when nothing is left unproven")

  // 390px: the buttons drop under the title instead of squeezing it to two words
  await page.setViewportSize({ width: 390, height: 800 })
  const link = await row(pa, "T001").locator("a").first().boundingBox()
  const approveBox = await row(pa, "T001").getByRole("button", { name: "Approve" }).boundingBox()
  assert.ok(link && approveBox && link.width > 300 && approveBox.y >= link.y + link.height - 1, `row at 390px: ${JSON.stringify({ link, approveBox })}`)
  await page.setViewportSize({ width: 1280, height: 900 })
  console.log("ok  390px: the title gets the row's width, the buttons sit under it")

  // j moves the keyboard row
  await page.locator("[data-inbox-row] a").first().focus()
  await page.keyboard.press("j")
  assert.equal(await page.locator("[data-inbox-row]").nth(1).getAttribute("data-focused"), "true")
  console.log("ok  j moves the focused row")

  const fileA = path.join(a, "plans/tasks/T001-review.md")
  const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await page.waitForTimeout(100); assert.ok(ok()) }

  // Approve → the toast closes the loop for the epic; Undo puts the task file back byte for byte
  const before = readFileSync(fileA, "utf8")
  await row(pa, "T001").getByRole("button", { name: "Approve" }).click()
  await row(pa, "T001").waitFor({ state: "detached" })
  await page.getByRole("status").getByText("Approved T001 · R002 now 1/1 done").waitFor()
  await until(() => /done/i.test(status(a, "T001-review.md")))
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click()
  await row(pa, "T001").waitFor()
  await until(() => readFileSync(fileA, "utf8") === before)
  console.log("ok  Approve says R002 is now 1/1 done; Undo brings the row back and the task file byte for byte")

  // S2 + Done when: clear the three repos' reviews from the inbox, never opening a project (a and s on the focused row)
  await row(pa, "T001").locator("a").first().focus()
  await page.keyboard.press("a")
  await row(pa, "T001").waitFor({ state: "detached" })
  await row(pc, "T001").getByRole("button", { name: "Approve" }).click()
  await row(pc, "T001").waitFor({ state: "detached" })
  await row(pb, "T002").locator("a").first().focus()
  await page.keyboard.press("s")
  await row(pb, "T002").getByRole("textbox").fill("Rename the button")
  await row(pb, "T002").getByRole("button", { name: "Send back" }).click()
  await row(pb, "T002").waitFor({ state: "detached" })
  await until(() => /todo/i.test(status(b, "T002-bravo.md")))
  assert.match(status(a, "T001-review.md"), /done/i)
  assert.match(status(c, "T001-charlie.md"), /done/i)
  assert.match(status(b, "T002-bravo.md"), /todo/i)
  assert.match(readFileSync(path.join(b, "plans/tasks/T002-bravo.md"), "utf8"), /Rename the button/)
  assert.equal(new URL(page.url()).pathname, "/inbox")
  const left = (await inbox()).filter((i) => [pa.id, pb.id, pc.id].includes(i.project.id) && i.kind === "review")
  assert.deepEqual(left, [])
  console.log("ok  S2: approved / sent back in three repos from the inbox; each task file changed in its own repo")

  // Empty inbox: the shared EmptyState
  await page.route("**/api/inbox**", (route) => route.fulfill({ json: [] }))
  await page.goto(`${BASE}/inbox`)
  await page.locator("[data-empty-state]").getByText("Nothing is waiting on you").waitFor()
  assert.equal(await page.locator("[data-inbox-count]").count(), 0)
  console.log("ok  empty inbox shows the empty state and no badge count")
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}

const res = await fetch(`${BASE}/api/projects/update`, {
  method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ id: pa.id, patch: { archived: true } }),
})
assert.equal(res.status, 200, await res.text())
assert.ok(!(await inbox()).some((i) => i.project.id === pa.id))
console.log("ok  archived project's items are excluded")
