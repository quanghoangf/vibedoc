// Project groups (R102): repos that make one product, saved in each member repo's .vibedoc/settings.json.
//
//   export VIBEDOC_HOME=$(mktemp -d)
//   PORT=3113 pnpm dev:next                                    # the server, with a throwaway hub
//   BASE=http://localhost:3113 PW_DIR=<dir with playwright> node e2e/project-groups.mjs
//
// Writes only into fresh mktemp fixture projects and the temp hub, never this repo or ~/.vibedoc.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"

/** A fixture project with `open` open tasks titled after it, one done task and one epic. */
function project(label, open, settings = null) {
  const root = makeFixture()
  writeFileSync(path.join(root, "plans/roadmap/R002-epic.md"), `# R002: ${label} epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n`)
  for (let i = 1; i <= open; i++) {
    writeFileSync(path.join(root, `plans/tasks/T00${i}-card.md`), `# T00${i}: ${label} card ${i}\n**Status:** todo\n**Phase:** R002\n`)
  }
  writeFileSync(path.join(root, `plans/tasks/T009-shipped.md`), `# T009: ${label} shipped\n**Status:** done\n**Phase:** R002\n`)
  if (settings) writeFileSync(path.join(root, ".vibedoc/settings.json"), JSON.stringify(settings, null, 2))
  return { root, label, ...registerProject(root) }
}

const settingsOf = (p) => { try { return JSON.parse(readFileSync(path.join(p.root, ".vibedoc/settings.json"), "utf8")) } catch { return {} } }

/** Path + bytes of every task file: a group change must never touch them. */
function tasksHash(p) {
  const h = createHash("sha256")
  const dir = path.join(p.root, "plans/tasks")
  for (const f of readdirSync(dir).sort()) { h.update(f); h.update(readFileSync(path.join(dir, f))) }
  return h.digest("hex")
}

async function api(route, body) {
  const res = body === undefined ? await fetch(`${BASE}${route}`) : await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify(body) })
  const data = await res.json()
  assert.ok(res.ok, `${route} → ${res.status} ${JSON.stringify(data)}`)
  return data
}

const webSettings = { statuses: [{ id: "qa", label: "QA", category: "review" }], tasks: { sizeDays: { M: 3 } } }
const web = project("Web", 5, webSettings)
const apiP = project("Api", 3)
const errors = []
const browser = await launchChrome()
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  const group = (slug) => page.locator(`[data-group-row="${slug}"]`)
  const member = (slug, gname, p) => group(slug).getByRole("button", { name: `Remove ${p.name} from ${gname}` })
  const hashes = [tasksHash(web), tasksHash(apiP)]

  // ── T538: create, rename, members, delete + Undo ─────────────────────────────
  await page.goto(`${BASE}/projects?project=${web.id}`)
  await page.getByRole("heading", { name: "Groups" }).waitFor()
  await page.getByRole("button", { name: "New group" }).click()
  const form = page.getByRole("form", { name: "New group" })
  await form.getByLabel("Group name").fill("Shop")
  await form.getByRole("checkbox", { name: web.name }).check()
  await form.getByRole("checkbox", { name: apiP.name }).check()
  await form.getByRole("button", { name: "Create group" }).click()
  await member("shop", "Shop", apiP).waitFor()
  assert.deepEqual(settingsOf(web), { ...webSettings, groups: ["shop"], groupNames: { shop: "Shop" } })
  assert.deepEqual(settingsOf(apiP), { groups: ["shop"], groupNames: { shop: "Shop" } })
  console.log("ok  create Shop with web + api → both settings.json have groups [shop], other keys unchanged")

  await group("shop").getByRole("button", { name: "Rename Shop" }).click()
  await group("shop").getByLabel("Name of the group Shop").fill("Shop app")
  await group("shop").getByRole("button", { name: "Save" }).click()
  await group("shop").getByText("Shop app", { exact: true }).waitFor()
  for (const p of [web, apiP]) assert.equal(settingsOf(p).groupNames?.shop, "Shop app")
  console.log("ok  rename writes the new name into every member, the slug stays")

  await member("shop", "Shop app", apiP).click()
  await member("shop", "Shop app", apiP).waitFor({ state: "detached" })
  assert.deepEqual(settingsOf(apiP), {})
  await group("shop").getByLabel("Add a project to Shop app").selectOption(apiP.id)
  await member("shop", "Shop app", apiP).waitFor()
  assert.deepEqual(settingsOf(apiP), { groups: ["shop"], groupNames: { shop: "Shop app" } })
  console.log("ok  remove a member clears its settings; add brings it back with the group's name")

  // A hub that knows only web still shows the group, with one member
  const { entry } = await api("/api/projects/remove", { id: apiP.id })
  const only = (await api("/api/groups")).find((g) => g.slug === "shop")
  assert.deepEqual(only?.members.map((m) => m.id), [web.id])
  await api("/api/projects/restore", { entry })
  assert.equal((await api("/api/groups")).find((g) => g.slug === "shop")?.members.length, 2)
  console.log("ok  a hub without api still shows Shop app with web alone")

  await page.reload()
  await group("shop").getByRole("button", { name: "Delete the group Shop app" }).click()
  await group("shop").waitFor({ state: "detached" })
  await page.getByText(/Deleted the group Shop app/).waitFor()
  assert.deepEqual(settingsOf(web), webSettings)
  assert.deepEqual(settingsOf(apiP), {})
  assert.deepEqual([tasksHash(web), tasksHash(apiP)], hashes, "tasks unchanged")
  const hub = JSON.parse(readFileSync(path.join(process.env.VIBEDOC_HOME, "hub.json"), "utf8"))
  for (const p of [web, apiP]) assert.ok(hub.projects.some((x) => x.id === p.id), "projects stay in the hub")
  await page.getByRole("button", { name: "Undo" }).click()
  await member("shop", "Shop app", apiP).waitFor()
  for (const p of [web, apiP]) assert.deepEqual(settingsOf(p).groups, ["shop"])
  assert.equal(settingsOf(web).groupNames.shop, "Shop app")
  console.log("ok  S2: delete removes the slug from both, projects + tasks unchanged; Undo restores it")

  // ── T539: the group board ───────────────────────────────────────────────────
  const card = (p, n) => page.getByRole("button", { name: `T00${n} ${p.label} card ${n}`, exact: true }).filter({ visible: true })
  await page.goto(`${BASE}/board?group=shop`)
  for (let n = 1; n <= 5; n++) await card(web, n).waitFor()
  for (let n = 1; n <= 3; n++) await card(apiP, n).waitFor()
  for (let n = 1; n <= 5; n++) assert.equal(await card(web, n).locator(`[data-repo-tag="${web.id}"]`).count(), 1, `web T00${n} tagged`)
  for (let n = 1; n <= 3; n++) assert.equal(await card(apiP, n).locator(`[data-repo-tag="${apiP.id}"]`).count(), 1, `api T00${n} tagged`)
  await page.locator("header").getByRole("button", { name: "Shop app" }).waitFor()
  console.log("ok  S1: /board?group=shop shows all 8 open tasks (5 web + 3 api), each tagged; both T001s, no key clash")

  const chips = page.getByRole("group", { name: "Show one repo" })
  await chips.getByRole("button", { name: new RegExp(`^${apiP.name}`) }).click()
  await card(web, 1).waitFor({ state: "detached" })
  for (let n = 1; n <= 3; n++) await card(apiP, n).waitFor()
  assert.equal(await page.getByRole("button", { name: /^T00\d Web card/ }).filter({ visible: true }).count(), 0)
  assert.equal(new URL(page.url()).searchParams.get("group"), "shop")
  await chips.getByRole("button", { name: "All repos" }).click()
  await card(web, 5).waitFor()
  console.log("ok  one click on the api chip shows only api's 3; All repos brings web back")

  // Moving api's T001 to done writes api's file only
  const webBefore = tasksHash(web)
  const apiT001 = path.join(apiP.root, "plans/tasks/T001-card.md")
  await card(apiP, 1).dragTo(page.locator('[data-column-header="done"]'))
  for (let i = 0; i < 50 && !readFileSync(apiT001, "utf8").includes("✅ Done"); i++) await page.waitForTimeout(100)
  assert.match(readFileSync(apiT001, "utf8"), /\*\*Status:\*\* ✅ Done/)
  assert.equal(tasksHash(web), webBefore, "web's task files unchanged")
  await card(web, 1).waitFor()
  console.log("ok  dragging api's T001 to Done writes only api's task file; web's T001 stays")

  // Pages without group support ask for a project; the switcher lists the group above the projects
  await page.getByRole("link", { name: /^Docs/ }).first().click()
  await page.getByText("Pick a project").waitFor()
  await page.getByRole("button", { name: `Open in ${web.name}` }).click()
  await page.waitForURL((u) => u.pathname === "/docs" && u.searchParams.get("project") === web.id && !u.searchParams.has("group"))
  await page.locator("header").getByRole("button", { name: web.name }).click()
  await page.getByRole("menuitem", { name: /Shop app/ }).click()
  await page.waitForURL((u) => u.pathname === "/board" && u.searchParams.get("group") === "shop")
  await card(apiP, 2).waitFor()
  console.log("ok  other pages ask to pick a member; the switcher opens the group's board")

  // Clicking a group card opens it in its own project
  await card(apiP, 2).click()
  await page.waitForURL((u) => u.searchParams.get("project") === apiP.id && u.searchParams.get("task") === "T002")
  await page.getByRole("dialog").or(page.locator("[data-task-panel]")).first().waitFor().catch(() => {})
  await page.getByText("Api card 2").first().waitFor()
  console.log("ok  a group card opens in its own project")

  // Unknown group: default project + toast
  await page.goto(`${BASE}/board?group=no-such-group`)
  await page.getByText(/No group “no-such-group”/).waitFor()
  assert.equal((await fetch(`${BASE}/api/tasks?group=no-such-group`)).status, 404)
  console.log("ok  unknown ?group= shows the default project and a toast; the API answers 404")

  assert.deepEqual(errors, [], "no page errors")
  console.log("ok  no page errors")
} finally {
  await browser.close()
  for (const p of [web, apiP]) rmSync(p.root, { recursive: true, force: true })
  // leave the hub as we found it, so a rerun against the same VIBEDOC_HOME sees only its own fixtures
  const hubFile = path.join(process.env.VIBEDOC_HOME, "hub.json")
  const hub = JSON.parse(readFileSync(hubFile, "utf8"))
  hub.projects = hub.projects.filter((p) => ![web, apiP].some((x) => x.id === p.id))
  writeFileSync(hubFile, JSON.stringify(hub, null, 2) + "\n")
}
