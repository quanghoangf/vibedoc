// End-to-end check for the desktop app (R111): an Electron window around the VibeDoc hub that already runs.
//   1. A foreground hub runs (`vibedoc --port 3085`): the app's window loads its URL, titled VibeDoc, and the menu's
//      status line names the address. Still one process listens on the port (S2: no second VibeDoc).
//      S4: links to other sites go to shell.openExternal (stubbed), a target=_blank hub link stays in the window,
//      file: and javascript: links do nothing.
//   2. Opening the app again focuses the one window: the second launch exits, still one window.
//   3. Closing the window, then quitting the app, leaves the hub answering GET /api/projects 200.
//   4. S3: nothing runs on the home's port: the app starts its own VibeDoc (starting screen, then the board, the menu
//      says "started by this app"); quitting stops it: nothing listens and no `next start` is left.
//   5. A start that fails (VIBEDOC_HOME is a file) shows the reason and Try again.
//   6. S1: the app (its own VibeDoc) and a Chrome tab on one fixture project: a move in the app and a rename in the tab
//      show on the other side within 1 s (SSE), and a chat started in the app (stubbed agent) shows in the tab's /chat.
//   7. S2 (R112): a local update feed with 99.0.0 → the banner, What's new with its notes, Later hides it after a
//      reload; a browser tab has no banner; an unreachable feed shows no banner and no error.
//
//   pnpm build && pnpm --dir desktop install && node e2e/desktop-app.mjs      (PORT=3085 by default)
//
// Temp VIBEDOC_HOME and Electron userData (never ~/.vibedoc or the real app's folder); the app runs with --lang=en-US.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { makeFixture, stubChat } from "./stub-chat.mjs"

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const desktopDir = path.join(repoDir, "desktop")
const bin = path.join(repoDir, "bin", "vibedoc.mjs")
const desktopRequire = createRequire(path.join(desktopDir, "package.json"))
const { _electron } = desktopRequire("playwright")
const electronBin = desktopRequire("electron")
const PORT = Number(process.env.PORT || 3085)
const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "vibedoc-desktop-e2e-")))
const loose = path.join(tmp, "loose")
mkdirSync(loose)
const children = new Set()
const apps = new Set()

/** A foreground hub on `port` with its own home; resolves once it answers. */
function startHub(home, port) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, VIBEDOC_HOME: home }
    delete env.VIBEDOC_ROOT
    const child = spawn(process.execPath, [bin, "--no-open", "--port", String(port)], { cwd: loose, env })
    children.add(child)
    let out = ""
    const timer = setTimeout(() => reject(new Error(`hub timed out:\n${out}`)), 90_000)
    child.stdout.on("data", (d) => { out += d; if (/Press Ctrl\+C/.test(out)) { clearTimeout(timer); resolve(child) } })
    child.stderr.on("data", (d) => { out += d })
    child.on("exit", (code) => { children.delete(child); clearTimeout(timer); reject(new Error(`hub exited ${code}:\n${out}`)) })
  })
}
const stopHub = (child) => new Promise((resolve) => {
  if (child.exitCode !== null) return resolve()
  child.removeAllListeners("exit")
  child.once("exit", () => { children.delete(child); resolve() })
  child.kill("SIGTERM")
})
const servers = (port) => {
  try { return new Set(execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)).size } catch { return 0 }
}
/** Pids listening on the port (the `next start` server; Next renames its process title, so find it by port). */
const listeners = (port) => {
  try { return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).map(Number) } catch { return [] }
}
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const answers = async (port) => (await fetch(`http://localhost:${port}/api/projects`).catch(() => null))?.status === 200

const appEnv = (home, userData) => ({ ...process.env, VIBEDOC_HOME: home, VIBEDOC_DESKTOP_USER_DATA: userData })
async function launch(home, userData) {
  const app = await _electron.launch({ executablePath: electronBin, args: [desktopDir, "--lang=en-US"], env: appEnv(home, userData) })
  apps.add(app)
  return app
}
const statusLine = (app) => app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].label)
async function waitFor(fn, what, ms = 20_000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 200))) if (await fn()) return
  throw new Error(`timed out waiting for ${what}`)
}

try {
  // 1. the running hub, in a window
  const home = path.join(tmp, "home")
  const hub = await startHub(home, PORT)
  const userData = path.join(tmp, "user-data")
  const app = await launch(home, userData)
  const win = await app.firstWindow()
  await win.waitForURL(`http://localhost:${PORT}/**`, { timeout: 30_000 })
  await waitFor(async () => /VibeDoc/.test(await win.title()), "the window title")
  assert.equal(await statusLine(app), `Using VibeDoc at http://localhost:${PORT}`, "the menu says which VibeDoc")
  assert.equal(servers(PORT), 1, "S2: no second VibeDoc")
  console.log("✓ the app opens the running hub in its window and says so")

  // S4: other sites go to the default browser (shell.openExternal stubbed), the hub's own links stay in the window
  await app.evaluate(({ shell }) => { globalThis.opened = []; shell.openExternal = async (url) => { globalThis.opened.push(url) } })
  const opened = () => app.evaluate(() => globalThis.opened)
  const click = (href, target) => win.evaluate(([href, target]) => {
    const a = document.createElement("a")
    a.href = href
    if (target) a.target = target
    a.textContent = "e2e link"
    document.body.append(a)
    a.click()
    a.remove()
  }, [href, target])
  const hubUrl = win.url()
  await click("https://example.com/docs")
  await waitFor(async () => (await opened()).includes("https://example.com/docs"), "openExternal for an in-page link")
  await click("https://example.org/new", "_blank")
  await waitFor(async () => (await opened()).includes("https://example.org/new"), "openExternal for target=_blank")
  assert.equal(win.url(), hubUrl, "the window stays on the hub")
  await click("file:///etc/hosts")
  await click("javascript:void(0)", "_blank")
  await new Promise((r) => setTimeout(r, 500))
  assert.deepEqual(await opened(), ["https://example.com/docs", "https://example.org/new"], "file: and javascript: go nowhere")
  assert.equal(win.url(), hubUrl)
  await click(`http://localhost:${PORT}/roadmap`, "_blank")
  await win.waitForURL(`http://localhost:${PORT}/roadmap**`)
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1, "a hub link opens in the app window")
  assert.equal((await opened()).length, 2)
  console.log("✓ S4: links to other sites open in the browser, the hub's own stay in the window, file:/javascript: do nothing")

  // 2. a second launch focuses the existing window and exits
  const second = spawn(electronBin, [desktopDir, "--lang=en-US"], { env: appEnv(home, userData) })
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { second.kill(); reject(new Error("the second launch didn't exit")) }, 20_000)
    second.on("exit", (c) => { clearTimeout(timer); resolve(c) })
  })
  assert.equal(code, 0, "the second launch quits")
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1, "still one window")
  console.log("✓ opening the app again keeps one window")

  // 3. closing never stops the hub
  await win.close()
  assert.ok(await answers(PORT), "the hub answers after the window closes")
  await app.close()
  apps.delete(app)
  assert.ok(await answers(PORT), "the hub answers after the app quits")
  assert.equal(servers(PORT), 1)
  console.log("✓ closing the window and quitting the app leave the hub running")
  await stopHub(hub)

  // 4. S3: nothing running → the app starts VibeDoc (starting screen, then the board) and stops it on quit
  const home2 = path.join(tmp, "home2")
  mkdirSync(home2)
  writeFileSync(path.join(home2, "port"), `${PORT + 1}\n`)
  assert.equal(servers(PORT + 1), 0)
  const app2 = await launch(home2, path.join(tmp, "user-data-2"))
  const win2 = await app2.firstWindow()
  const titles = new Set()
  await waitFor(async () => { titles.add(await win2.title().catch(() => "")); return win2.url().startsWith(`http://localhost:${PORT + 1}/`) }, "the board", 90_000)
  assert.ok(titles.has("Starting VibeDoc…"), `the starting screen showed (saw ${[...titles].join(" | ")})`)
  assert.equal(await statusLine(app2), `VibeDoc at http://localhost:${PORT + 1} · started by this app`)
  assert.equal(servers(PORT + 1), 1)
  assert.ok(existsSync(path.join(home2, "logs", "desktop-server.log")), "the child's output is logged")
  const serverPids = listeners(PORT + 1)
  assert.equal(serverPids.length, 1, "the app's next start listens")
  await app2.close()
  apps.delete(app2)
  await waitFor(async () => servers(PORT + 1) === 0 && !(await answers(PORT + 1)), "the app's VibeDoc to stop", 15_000)
  assert.ok(!serverPids.some(alive), "no next start left behind")
  console.log("✓ with nothing running the app starts VibeDoc, shows the board, and quitting stops it")

  // 5. a start that fails shows why, with Try again, not a blank window
  const badHome = path.join(tmp, "not-a-folder")
  writeFileSync(badHome, "")
  const app3 = await launch(badHome, path.join(tmp, "user-data-3"))
  const win3 = await app3.firstWindow()
  await waitFor(async () => (await win3.title()) === "VibeDoc couldn’t start", "the failure page", 30_000)
  assert.ok(await win3.getByRole("link", { name: "Try again" }).isVisible())
  assert.ok((await win3.locator("#reason").textContent()).length > 0, "a reason is shown")
  assert.equal(await statusLine(app3), "VibeDoc isn’t running")
  await app3.close()
  apps.delete(app3)
  console.log("✓ a failed start shows the reason and Try again")
  // 6. S1 (Done when): the app (its own VibeDoc, the S3 path) and a browser tab on the same project stay in sync
  const home3 = path.join(tmp, "home3")
  mkdirSync(home3)
  writeFileSync(path.join(home3, "port"), `${PORT + 2}\n`)
  process.env.VIBEDOC_HOME = home3 // makeFixture / stubChat register the fixture in this hub
  const fx = makeFixture()
  writeFileSync(path.join(fx, "plans/tasks/T001-sync-me.md"), "# T001: Sync me\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n**Size:** S\n\n## Goal\nMove me.\n")
  const app4 = await launch(home3, path.join(tmp, "user-data-4"))
  const win4 = await app4.firstWindow()
  await waitFor(async () => win4.url().startsWith(`http://localhost:${PORT + 2}/`), "the app's VibeDoc", 90_000)
  const reply = [
    { type: "stream_event", session_id: "s1", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hello from the stub agent" } } },
    { type: "result", is_error: false, session_id: "s1" },
  ]
  await stubChat(win4, reply, { root: fx })
  const browser = await desktopRequire("playwright").chromium.launch({ channel: "chrome" })
  try {
    const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    await stubChat(tab, reply, { root: fx })
    const base = `http://localhost:${PORT + 2}`
    await Promise.all([win4.goto(`${base}/board`), tab.goto(`${base}/board`)])
    const card = (page, column, title) => page.locator(`[data-column="${column}"]`).getByText(title, { exact: true })
    await card(win4, "todo", "Sync me").waitFor({ timeout: 30_000 })
    await card(tab, "todo", "Sync me").waitFor({ timeout: 30_000 })
    const post = (page, url, body) => page.evaluate(async ([url, body]) => (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).status, [url, body])

    // the app moves the task (the board's own POST /api/tasks) → the tab shows it in its new column within 1 s
    assert.equal(await post(win4, `/api/tasks?root=${encodeURIComponent(fx)}`, { taskId: "T001", status: "in-progress" }), 200)
    await card(tab, "in-progress", "Sync me").waitFor({ timeout: 1000 })
    // the tab renames it (the panel's POST /api/tasks/update) → the app shows the new title within 1 s
    assert.equal(await post(tab, `/api/tasks/update?root=${encodeURIComponent(fx)}`, { id: "T001", patch: { title: "Synced both ways" } }), 200)
    await card(win4, "in-progress", "Synced both ways").waitFor({ timeout: 1000 })
    console.log("✓ S1: a move in the app and a rename in the tab each show on the other side within 1 s")

    // a chat started in the app (stubbed agent) shows in the tab's /chat list
    await tab.goto(`${base}/chat`)
    await win4.keyboard.press("c")
    const box = win4.getByPlaceholder(/Ask the agent/)
    await box.fill("sync check from the app")
    await box.press("Enter")
    await win4.getByText("Hello from the stub agent").waitFor({ timeout: 15_000 })
    await tab.getByText("sync check from the app").first().waitFor({ timeout: 10_000 })
    console.log("✓ S1: a chat started in the app shows in the browser's /chat list")
  } finally {
    await browser.close()
  }
  await app4.close()
  apps.delete(app4)
  rmSync(fx, { recursive: true, force: true })
  // 7. S2 (T582): a newer version on the feed → the banner, What's new shows its notes, Later hides that version for
  //    good; a browser tab never shows it; an unreachable feed shows nothing
  const home5 = path.join(tmp, "home5")
  const hub5 = await startHub(home5, PORT + 3)
  const feedFile = process.platform === "darwin" ? "latest-mac.yml" : process.platform === "win32" ? "latest.yml" : "latest-linux.yml"
  const zip = Buffer.from("PK\x05\x06" + "\0".repeat(18), "binary") // an empty zip: enough to download and verify
  const zipSha = createHash("sha512").update(zip).digest("base64")
  const feedYml = [
    "version: 99.0.0",
    "files:",
    "  - url: VibeDoc-99.0.0.zip",
    `    sha512: ${zipSha}`,
    `    size: ${zip.length}`,
    "path: VibeDoc-99.0.0.zip",
    `sha512: ${zipSha}`,
    "releaseDate: '2026-10-21T08:00:00.000Z'",
    "releaseNotes: |",
    "  ## Faster boards",
    "",
    "  - Moved cards stay where you put them",
  ].join("\n") + "\n"
  const feed = createServer((req, res) => {
    if (req.url?.startsWith(`/${feedFile}`)) { res.writeHead(200, { "content-type": "text/yaml" }); res.end(feedYml) }
    else if (req.url?.startsWith("/VibeDoc-99.0.0.zip")) { res.writeHead(200, { "content-type": "application/zip", "content-length": zip.length }); res.end(zip) }
    else { res.writeHead(404); res.end() }
  })
  await new Promise((r) => feed.listen(0, "127.0.0.1", r))
  const feedUrl = `http://127.0.0.1:${feed.address().port}/`
  const updData = path.join(tmp, "user-data-5")
  const launchWithFeed = async (url) => {
    const a = await _electron.launch({ executablePath: electronBin, args: [desktopDir, "--lang=en-US"], env: { ...appEnv(home5, updData), VIBEDOC_UPDATE_FEED: url } })
    apps.add(a)
    return a
  }
  const app5 = await launchWithFeed(feedUrl)
  const win5 = await app5.firstWindow()
  await win5.waitForURL(`http://localhost:${PORT + 3}/**`, { timeout: 30_000 })
  const banner = win5.getByRole("region", { name: "VibeDoc update" })
  await banner.getByText("VibeDoc 99.0.0 is available").waitFor({ timeout: 20_000 })
  await banner.getByRole("button", { name: "What's new" }).click()
  const notes = win5.getByRole("dialog")
  await notes.getByRole("heading", { name: "What's new in VibeDoc 99.0.0" }).waitFor()
  await notes.getByText("Moved cards stay where you put them").waitFor()
  await notes.getByRole("button", { name: "Later" }).click()
  await banner.waitFor({ state: "detached" })
  await win5.reload()
  await win5.getByRole("navigation").first().waitFor({ timeout: 30_000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 1500))
  assert.equal(await win5.locator("[data-desktop-update]").count(), 0, "Later keeps 99.0.0 hidden after a reload")
  await app5.close()
  apps.delete(app5)
  console.log("✓ S2: a newer version shows a banner, What's new shows its notes, Later hides that version")

  // T583: Update downloads it. macOS installs only into a signed app, so an unsigned one (this e2e) ends on the
  // release-page fallback; elsewhere the card offers Restart to update
  const app7 = await _electron.launch({ executablePath: electronBin, args: [desktopDir, "--lang=en-US"], env: { ...appEnv(home5, path.join(tmp, "user-data-7")), VIBEDOC_UPDATE_FEED: feedUrl } })
  apps.add(app7)
  const win7 = await app7.firstWindow()
  await win7.waitForURL(`http://localhost:${PORT + 3}/**`, { timeout: 30_000 })
  const card7 = win7.getByRole("region", { name: "VibeDoc update" })
  await card7.getByRole("button", { name: "Update" }).click({ timeout: 20_000 })
  if (process.platform === "darwin") {
    await card7.getByText("VibeDoc 99.0.0 couldn’t be installed from here").waitFor({ timeout: 30_000 })
    assert.equal(await card7.getByRole("link", { name: "Download the new version" }).getAttribute("href"), "https://github.com/quanghoangf/vibedoc/releases/tag/v99.0.0")
    assert.ok(await card7.getByRole("button", { name: "Try again" }).isVisible())
    console.log("✓ T583: Update downloads; an unsigned macOS app falls back to the release page, no crash")
  } else {
    await card7.getByRole("button", { name: "Restart to update" }).waitFor({ timeout: 30_000 })
    console.log("✓ T583: Update downloads and offers Restart to update")
  }
  await app7.close()
  apps.delete(app7)

  const browser5 = await desktopRequire("playwright").chromium.launch({ channel: "chrome" })
  try {
    const tab5 = await browser5.newPage()
    await tab5.goto(`http://localhost:${PORT + 3}/board`)
    await tab5.waitForLoadState("networkidle")
    assert.equal(await tab5.evaluate(() => typeof window.vibedocDesktop), "undefined")
    assert.equal(await tab5.locator("[data-desktop-update]").count(), 0, "no banner in a browser tab")
  } finally {
    await browser5.close()
  }
  feed.close()
  const app6 = await launchWithFeed("http://127.0.0.1:9/") // nothing listens: offline
  const win6 = await app6.firstWindow()
  await win6.waitForURL(`http://localhost:${PORT + 3}/**`, { timeout: 30_000 })
  await new Promise((r) => setTimeout(r, 4000))
  assert.equal(await win6.locator("[data-desktop-update]").count(), 0, "offline: no banner")
  assert.equal(await app6.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1, "offline: no error window")
  await app6.close()
  apps.delete(app6)
  await stopHub(hub5)
  console.log("✓ no banner in a browser tab, and none (and no error) when the feed can't be reached")
  console.log("desktop-app e2e: ok")
} finally {
  for (const app of apps) await app.close().catch(() => {})
  for (const child of children) child.kill("SIGKILL")
  rmSync(tmp, { recursive: true, force: true })
}
