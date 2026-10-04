// Browser check for R059 (screenshots & video capture), T152: the task panel's Runs section.
//   1. A task with runs shows the newest run: status, x/y steps passed, one thumbnail per step named after it.
//   2. A failed step shows ✗; clicking it opens the full image with the error text.
//   3. The video loads with a non-zero duration and seeks.
//   4. Switching the run in the select swaps the thumbnails and the video.
//   5. A task without runs shows the empty state. At 390px the panel doesn't scroll sideways.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/task-runs.mjs
//
// Seeds run dirs (PNGs + a webm recorded by Playwright itself + run.json) for a fresh mktemp fixture project under
// `$VIBEDOC_RUNS_DIR` (default ~/.vibedoc/runs; it must match the server's), in the fixture's own project folder,
// which is removed at the end. Only /api/projects is stubbed.
import assert from "node:assert/strict"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
writeFileSync(path.join(fx, "plans/tasks/T001-login.md"), "# T001: Login form\n**Status:** 🔨 In-progress\n**Phase:** R002\n\n## Goal\nLog in.\n")
writeFileSync(path.join(fx, "plans/tasks/T002-untested.md"), "# T002: Untested\n**Status:** 📋 Todo\n**Phase:** R002\n\n## Goal\nNothing run yet.\n")
// Same rule as runs-paths.ts projectKey(): slugged basename of the root
const projectKey = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const projectRuns = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(homedir(), ".vibedoc", "runs"), projectKey)

const OLD = "20261001T100000Z"
const NEW = "20261004T100000Z"

const browser = await launchChrome()
const errors = []
try {
  // Media: two step screenshots and a ~1.5s video, recorded by this browser (no ffmpeg needed)
  const media = mkdtempSync(path.join(tmpdir(), "vibedoc-runs-media-"))
  const rec = await browser.newContext({ viewport: { width: 320, height: 240 }, recordVideo: { dir: media, size: { width: 320, height: 240 } } })
  const recPage = await rec.newPage()
  await recPage.setContent('<body style="margin:0;background:#2a6;font:40px sans-serif;color:#fff">Step one</body>')
  await recPage.screenshot({ path: path.join(media, "a.png") })
  await recPage.waitForTimeout(800)
  await recPage.setContent('<body style="margin:0;background:#c33;font:40px sans-serif;color:#fff">Step two</body>')
  await recPage.screenshot({ path: path.join(media, "b.png") })
  await recPage.waitForTimeout(800)
  const video = recPage.video()
  await rec.close()
  await video.saveAs(path.join(media, "video.webm"))

  const seed = (runId, status, steps) => {
    const dir = path.join(projectRuns, "T001", runId)
    mkdirSync(dir, { recursive: true })
    for (const s of steps) if (s.screenshot) copyFileSync(path.join(media, s.src), path.join(dir, s.screenshot))
    copyFileSync(path.join(media, "video.webm"), path.join(dir, "video.webm"))
    const at = `${runId.slice(0, 4)}-${runId.slice(4, 6)}-${runId.slice(6, 8)}T10:00:00.000Z`
    writeFileSync(path.join(dir, "run.json"), JSON.stringify({
      runId, taskId: "T001", project: projectKey, startedAt: at, endedAt: at, status, commit: null, video: "video.webm",
      steps: steps.map(({ src, ...s }, i) => ({ index: i + 1, error: null, ...s })),
    }))
  }
  seed(OLD, "passed", [{ name: "Old run only step", status: "passed", screenshot: "01-old-run-only-step.png", src: "a.png" }])
  seed(NEW, "failed", [
    { name: "Open /login → form shows", status: "passed", screenshot: "01-open-login-form-shows.png", src: "a.png" },
    { name: "Submit → dashboard loads", status: "failed", screenshot: "02-submit-dashboard-loads.png", src: "b.png", error: "Timed out waiting for /dashboard" },
  ])

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Newest run: header + one thumbnail per step, named after the checklist item
  await page.goto(`${BASE}/board?task=T001`)
  const runs = page.locator('section[aria-label="Test runs"]')
  await runs.getByText("1/2", { exact: true }).waitFor()
  await runs.getByText("failed", { exact: true }).waitFor()
  const thumbs = runs.locator("ul img")
  assert.deepEqual(await thumbs.evaluateAll((els) => els.map((e) => e.alt)), ["Open /login → form shows", "Submit → dashboard loads"])
  await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Test runs"] ul img')].every((i) => i.complete && i.naturalWidth > 0))
  await runs.getByRole("button", { name: /Open \/login → form shows/ }).getByLabel("passed").waitFor()
  console.log("ok  newest run: failed · 1/2 steps passed, both screenshots load, named after the steps")

  // 2. Failed step: ✗, error on hover (title) and in the dialog
  const failed = runs.getByRole("button", { name: /Submit → dashboard loads/ })
  await failed.getByLabel("failed").waitFor()
  assert.match(await failed.getAttribute("title"), /Timed out waiting for \/dashboard/)
  await failed.click()
  const dialog = page.getByRole("dialog", { name: "Submit → dashboard loads" })
  await dialog.getByText("Timed out waiting for /dashboard").waitFor()
  assert.ok(await dialog.locator("img").evaluate((i) => i.decode().then(() => i.naturalWidth > 0)))
  // Escape closes only the viewer, not the task panel under it
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  await runs.waitFor({ timeout: 2000 })
  console.log("ok  failed step shows ✗, its error on hover and in the full-image dialog; Escape keeps the panel")

  // 3. Video plays and seeks
  const vid = runs.locator("video")
  assert.ok(await vid.evaluate((v) => v.hasAttribute("controls") && v.preload === "metadata"))
  const duration = await vid.evaluate((v) => new Promise((res, rej) => {
    const done = () => res(v.duration)
    if (v.readyState >= 1) done(); else { v.onloadedmetadata = done; v.onerror = () => rej(new Error("video error")) }
  }))
  assert.ok(duration > 0, `duration ${duration}`)
  const seeked = await vid.evaluate((v) => new Promise((res) => {
    v.onseeked = () => res(v.currentTime)
    v.currentTime = Number.isFinite(v.duration) ? v.duration / 2 : 0.5
  }))
  assert.ok(seeked > 0, `seeked to ${seeked}`)
  console.log(`ok  video loads (${Number.isFinite(duration) ? duration.toFixed(2) + "s" : duration}) and seeks`)

  // 4. Switching the run swaps thumbnails and video
  const oldSrc = await vid.getAttribute("src")
  await runs.getByLabel("Run").selectOption(OLD)
  await runs.getByText("1/1", { exact: true }).waitFor()
  assert.deepEqual(await thumbs.evaluateAll((els) => els.map((e) => e.alt)), ["Old run only step"])
  const newSrc = await vid.getAttribute("src")
  assert.notEqual(newSrc, oldSrc)
  assert.match(newSrc, new RegExp(OLD))
  console.log("ok  picking the older run swaps the thumbnails and the video")

  // 5. Empty state, and no sideways scroll at 390px
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/board?task=T001`)
  await runs.getByText("1/2", { exact: true }).waitFor()
  const overflow = await page.locator('[role="dialog"]').first().evaluate((el) => {
    const scroller = el.querySelector(".overflow-y-auto") ?? el
    return scroller.scrollWidth - scroller.clientWidth
  })
  assert.ok(overflow <= 0, `panel overflows by ${overflow}px at 390px`)
  await page.goto(`${BASE}/board?task=T002`)
  await page.locator('section[aria-label="Test runs"]').getByText("No recorded runs yet").waitFor()
  console.log("ok  no sideways scroll at 390px; a task without runs shows the empty state")

  assert.deepEqual(errors, [], `console errors:\n${errors.join("\n")}`)
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(projectRuns, { recursive: true, force: true })
}
