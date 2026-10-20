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
//
//   pnpm build && pnpm --dir desktop install && node e2e/desktop-app.mjs      (PORT=3085 by default)
//
// Temp VIBEDOC_HOME and Electron userData (never ~/.vibedoc or the real app's folder); the app runs with --lang=en-US.
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

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
  console.log("desktop-app e2e: ok")
} finally {
  for (const app of apps) await app.close().catch(() => {})
  for (const child of children) child.kill("SIGKILL")
  rmSync(tmp, { recursive: true, force: true })
}
