// End-to-end check for the desktop app (R111): an Electron window around the VibeDoc hub that already runs.
//   1. A foreground hub runs (`vibedoc --port 3085`): the app's window loads its URL, titled VibeDoc, and the menu's
//      status line names the address. Still one process listens on the port (S2: no second VibeDoc).
//   2. Opening the app again focuses the one window: the second launch exits, still one window.
//   3. Closing the window, then quitting the app, leaves the hub answering GET /api/projects 200.
//   4. Nothing runs on the home's port: the not-running page shows; once a hub starts there, the window opens it.
//
//   pnpm build && pnpm --dir desktop install && node e2e/desktop-app.mjs      (PORT=3085 by default)
//
// Temp VIBEDOC_HOME and Electron userData (never ~/.vibedoc or the real app's folder); the app runs with --lang=en-US.
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
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

  // 4. nothing running: the not-running page, then the hub as soon as it answers
  const home2 = path.join(tmp, "home2")
  mkdirSync(home2)
  writeFileSync(path.join(home2, "port"), `${PORT + 1}\n`)
  const app2 = await launch(home2, path.join(tmp, "user-data-2"))
  const win2 = await app2.firstWindow()
  await waitFor(async () => (await win2.title()) === "VibeDoc isn’t running", "the not-running page")
  assert.ok(win2.url().startsWith("file:"), "a local page, no server")
  assert.ok(await win2.getByText(`Looking for VibeDoc at http://localhost:${PORT + 1}`).isVisible())
  assert.equal(await statusLine(app2), "VibeDoc isn’t running")
  const hub2 = await startHub(home2, PORT + 1)
  await win2.waitForURL(`http://localhost:${PORT + 1}/**`, { timeout: 30_000 })
  await waitFor(async () => (await statusLine(app2)) === `Using VibeDoc at http://localhost:${PORT + 1}`, "the status line")
  console.log("✓ with nothing running the app waits on the not-running page, then opens the hub once it answers")
  await app2.close()
  apps.delete(app2)
  await stopHub(hub2)
  console.log("desktop-app e2e: ok")
} finally {
  for (const app of apps) await app.close().catch(() => {})
  for (const child of children) child.kill("SIGKILL")
  rmSync(tmp, { recursive: true, force: true })
}
