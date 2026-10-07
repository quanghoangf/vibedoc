// Browser check for R091 (release notes from done work), on a fixture git repo tagged v1.0.0 on 2026-10-01:
//   1. S1: Draft release notes on /roadmap → a CHANGELOG.md diff with `# Unreleased`, the done epic and the two tasks
//      finished after the tag
//   2. S3: a task done before the tag and a task already named in CHANGELOG.md are not in the draft
//   3. S2: closing the dialog writes nothing; Accept puts the section on top, past entries byte-for-byte
//   4. S3: opened again → "Nothing to draft", no Accept
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3191 pnpm dev   # then:
//   BASE=http://localhost:3191 PW_DIR=<dir with node_modules/playwright> node e2e/release-notes.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3191"
const fx = makeFixture()
const git = (args, env = {}) =>
  execFileSync("git", ["-c", "user.name=e2e", "-c", "user.email=e2e@example.com", ...args], { cwd: fx, encoding: "utf8", env: { ...process.env, ...env } })
const task = (id, title, done) => writeFileSync(path.join(fx, `plans/tasks/${id}-${title.toLowerCase().replace(/ /g, "-")}.md`),
  [`# ${id}: ${title}`, "**Status:** ✅ Done", `**Done:** ${done}`, "**Phase:** R002 — Epic", "**Depends on:** —", "", "## Goal", "x", ""].join("\n"))
const past = "# [1.0.0](https://example.com/v1.0.0) (2026-10-01)\n\n### Features\n\n* listed already (T004)\n"
const changelog = path.join(fx, "CHANGELOG.md")

writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Search box\n**Parent:** R001\n**Status:** done\n**Order:** 10\n**Tasks:** T001, T002, T003, T004\n")
task("T001", "Old work", "2026-09-20")
task("T002", "Search field", "2026-10-03")
task("T003", "Search results", "2026-10-04")
task("T004", "Listed work", "2026-10-02")
writeFileSync(changelog, past)
git(["init", "-q"])
git(["add", "-A"])
git(["commit", "-qm", "init"], { GIT_COMMITTER_DATE: "2026-10-01T12:00:00Z", GIT_AUTHOR_DATE: "2026-10-01T12:00:00Z" })
git(["tag", "v1.0.0"])

const browser = await launchChrome()
const errors = []
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/roadmap`)

  const open = async () => {
    await page.getByRole("button", { name: "Draft release notes" }).click()
    const dialog = page.getByRole("dialog", { name: "Draft release notes" })
    await dialog.waitFor()
    return dialog
  }
  let dialog = await open()
  await dialog.getByText("Done work since v1.0.0 (2026-10-01)", { exact: false }).waitFor()
  await dialog.getByText("+ ### Search box (R002)").waitFor()
  await dialog.getByText("+ * Search field (T002)").waitFor()
  await dialog.getByText("+ * Search results (T003)").waitFor()
  assert.match(await dialog.getByText(/^\+ # Unreleased \(\d{4}-\d{2}-\d{2}\)$/).innerText(), /Unreleased/)
  console.log("ok  S1: one click shows a CHANGELOG.md diff with the done epic and its tasks since the tag")

  assert.equal(await dialog.getByText("(T001)").count(), 0, "a task done before the tag is left out")
  assert.equal(await dialog.getByText("+ * Listed work (T004)").count(), 0, "a task already in CHANGELOG.md is left out")
  console.log("ok  S3: work before the tag or already listed is not drafted")

  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  assert.equal(readFileSync(changelog, "utf8"), past, "closing writes nothing")
  console.log("ok  S2: closing the draft leaves CHANGELOG.md unchanged")

  dialog = await open()
  await dialog.getByRole("button", { name: "Accept" }).click()
  await dialog.waitFor({ state: "hidden" })
  await page.getByText("Release notes added to CHANGELOG.md").waitFor()
  const after = readFileSync(changelog, "utf8")
  assert.ok(after.endsWith(past), "past entries byte-for-byte")
  assert.match(after, /^# Unreleased \(\d{4}-\d{2}-\d{2}\)\n\n### Search box \(R002\)\n\n\* Search field \(T002\)\n\* Search results \(T003\)\n\n# \[1\.0\.0\]/)
  console.log("ok  S2: Accept writes the section on top, past entries unchanged")

  dialog = await open()
  await dialog.getByText("Nothing to draft", { exact: false }).waitFor()
  assert.equal(await dialog.getByRole("button", { name: "Accept" }).count(), 0)
  console.log("ok  S3: nothing new → nothing to draft")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("release-notes: all ok")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
