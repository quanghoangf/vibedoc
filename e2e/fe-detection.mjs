// Browser check for R057 (Frontend app detection), end to end on a fixture Vite app. The epic's Done-when:
// on a fresh project with a web frontend, VibeDoc shows the detected app, start command and URL, and a
// smoke test can open the app's first page logged in.
//   1. /settings → Frontend app shows the detected Vite app, its start command and URL.
//   2. Run smoke test with the app down and no session: VibeDoc starts it, the page lands on /login
//      ("Looks logged out" + "No saved session"), a screenshot shows, and the app is stopped again.
//   3. With a saved session (storage-state.json): the smoke ends on / logged in, no warning.
//   4. An app the user started from Settings is reused and left running.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/fe-detection.mjs
//
// The fixture's "Vite" app is a tiny node server (vite is only declared, for detection); its Playwright is
// a symlink to PW_DIR's, so the Chromium Playwright downloaded for that version must be installed.
// Writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const PW_DIR = path.resolve(process.env.PW_DIR ?? process.cwd())
const PORT = 4300 + Math.floor(Math.random() * 600)
const APP_URL = `http://localhost:${PORT}`

const fx = makeFixture()
writeFileSync(path.join(fx, "package.json"), JSON.stringify({
  name: "fe-fixture", private: true, scripts: { dev: `node server.js --port ${PORT}` }, dependencies: { vite: "5" },
}, null, 2))
// "/" needs the sid cookie, else it redirects to /login
writeFileSync(path.join(fx, "server.js"), `
const port = Number(process.argv[process.argv.indexOf("--port") + 1])
require("http").createServer((req, res) => {
  const html = (body) => { res.setHeader("content-type", "text/html"); res.end("<!doctype html><title>fixture</title><h1>" + body + "</h1>") }
  if (req.url.startsWith("/login")) return html("Please log in")
  if (/(^|; )sid=ok/.test(req.headers.cookie ?? "")) return html("Dashboard: logged in")
  res.writeHead(302, { location: "/login" }).end()
}).listen(port)
`)
mkdirSync(path.join(fx, "node_modules"))
symlinkSync(path.join(PW_DIR, "node_modules/playwright"), path.join(fx, "node_modules/playwright"), "dir")

const q = `?root=${encodeURIComponent(fx)}`
const api = async (route, init) => {
  const res = await fetch(`${BASE}${route}${q}`, init)
  return { status: res.status, json: await res.json().catch(() => null) }
}
const post = (route, body = {}) => api(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const up = () => fetch(APP_URL, { redirect: "manual", signal: AbortSignal.timeout(1500) }).then(() => true, () => false)
async function waitDown() {
  for (let i = 0; i < 40; i++) {
    if (!(await up())) return
    await new Promise((r) => setTimeout(r, 250))
  }
  assert.fail(`${APP_URL} still answers after the smoke test`)
}

const browser = await launchChrome()
const errors = []
try {
  const put = await api("/api/frontend", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ override: { loginPath: "/login" } }) })
  assert.equal(put.status, 200, JSON.stringify(put.json))
  assert.equal(await up(), false, "the fixture app starts down")

  // 1. Settings shows the detected app
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/settings`)
  await page.getByRole("button", { name: "Frontend app" }).click()
  const appBox = page.getByTestId("frontend-app")
  await appBox.getByText("Vite").waitFor()
  await appBox.getByText("npm run dev", { exact: true }).waitFor()
  await appBox.getByText(APP_URL).waitFor()
  await page.getByTestId("playwright-pill").getByText(/^Installed/).waitFor()
  console.log("ok  /settings shows the Vite app, npm run dev and", APP_URL)

  // 2. Smoke with the app down and no session: started, lands on /login, warned, stopped again
  const smoke = page.getByTestId("frontend-smoke")
  await smoke.getByRole("button", { name: "Run smoke test" }).click()
  await smoke.getByTestId("smoke-pill").waitFor({ timeout: 90000 })
  assert.equal(await smoke.getByTestId("smoke-pill").innerText(), "Passed", await smoke.innerText())
  assert.equal(await smoke.getByTestId("smoke-url").innerText(), `${APP_URL}/login`)
  await smoke.getByText(/Looks logged out/).waitFor()
  await smoke.getByText(/No saved session/).waitFor()
  await smoke.getByText(/started and stopped the app/).waitFor()
  const shot = smoke.getByTestId("smoke-shot")
  await shot.waitFor()
  await page.waitForFunction(() => document.querySelector('[data-testid="smoke-shot"]')?.naturalWidth > 0)
  await waitDown()
  console.log("ok  smoke with no session: started the app, landed on /login with both warnings, screenshot, stopped it")

  // 3. Saved session → logged in, no warning; the screenshot is served by the route
  mkdirSync(path.join(fx, ".vibedoc/auth"), { recursive: true })
  writeFileSync(path.join(fx, ".vibedoc/auth/storage-state.json"), JSON.stringify({
    cookies: [{ name: "sid", value: "ok", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
    origins: [],
  }))
  const loggedIn = await post("/api/frontend/smoke")
  assert.equal(loggedIn.status, 200)
  assert.equal(loggedIn.json.ok, true, JSON.stringify(loggedIn.json))
  assert.equal(loggedIn.json.finalUrl, `${APP_URL}/`)
  assert.equal(loggedIn.json.status, 200)
  assert.deepEqual(loggedIn.json.notes, [])
  assert.equal(loggedIn.json.startedServer, true)
  assert.equal(loggedIn.json.screenshot, true)
  const png = await fetch(`${BASE}/api/frontend/smoke${q}`)
  assert.equal(png.headers.get("content-type"), "image/png")
  assert.deepEqual([...new Uint8Array(await png.arrayBuffer()).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47])
  await waitDown()
  console.log("ok  smoke with a saved session: logged in on /, no warning, PNG served, app stopped")

  // 4. A server the user started stays up
  const started = await post("/api/frontend/server", { action: "start" })
  assert.equal(started.status, 200, JSON.stringify(started.json))
  const reused = await post("/api/frontend/smoke")
  assert.equal(reused.json.ok, true)
  assert.equal(reused.json.startedServer, false)
  assert.equal(await up(), true, "the user's server is left running")
  assert.equal((await post("/api/frontend/server", { action: "stop" })).status, 200)
  await waitDown()
  console.log("ok  a server started from Settings is reused and left running")

  assert.deepEqual(errors, [], "browser console errors")
  console.log("fe-detection: ok")
} finally {
  await browser.close()
  // Never leave the fixture app running
  await post("/api/frontend/server", { action: "stop" }).catch(() => {})
}
