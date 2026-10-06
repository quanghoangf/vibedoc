// Browser check for R079 (watchable evidence videos) on a fixture project, one section per task:
//   S1 (T225): the run player's speed control → 0.5× plays at half speed (video.playbackRate), survives a reload
//              and a switch to another task's run.
//   S2 (T226): auto-pause (on by default) stops on each step's screenshot frame with "Step N · <name>" over the
//              video; Play goes on to the next step; off → plays through; the choice survives a reload.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/watchable-video.mjs
//
// Seeds timed runs (two steps with startMs/endMs, their screenshots and a ~2.4s webm recorded by this browser)
// under `$VIBEDOC_RUNS_DIR` (default ~/.vibedoc/runs; it must match the server's) in the fixture's own project
// folder, removed at the end. Only /api/projects is stubbed.
import assert from "node:assert/strict"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
for (const id of ["T001", "T002"]) {
  writeFileSync(path.join(fx, `plans/tasks/${id}-video.md`), `# ${id}: Video ${id}\n**Status:** ✅ Done\n**Phase:** R002\n\n## Goal\nA run to watch.\n`)
}
// Same rule as runs-paths.ts projectKey(): slugged basename of the root
const projectKey = path.basename(fx).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const projectRuns = path.join(process.env.VIBEDOC_RUNS_DIR || path.join(homedir(), ".vibedoc", "runs"), projectKey)
const RUN = "20261005T100000Z"
const STEPS = [
  { name: "Open the page → it shows step one", startMs: 0, endMs: 1100, screenshot: "01-step-one.png", src: "a.png" },
  { name: "Click next → it shows step two", startMs: 1100, endMs: 2200, screenshot: "02-step-two.png", src: "b.png" },
]

const browser = await launchChrome()
const errors = []
const media = mkdtempSync(path.join(tmpdir(), "vibedoc-video-media-"))
try {
  // Media recorded by this browser (no ffmpeg needed): ~1.1s per step
  const rec = await browser.newContext({ viewport: { width: 320, height: 240 }, recordVideo: { dir: media, size: { width: 320, height: 240 } } })
  const recPage = await rec.newPage()
  await recPage.setContent('<body style="margin:0;background:#2a6;font:40px sans-serif;color:#fff">Step one</body>')
  await recPage.screenshot({ path: path.join(media, "a.png") })
  await recPage.waitForTimeout(1100)
  await recPage.setContent('<body style="margin:0;background:#36c;font:40px sans-serif;color:#fff">Step two</body>')
  await recPage.screenshot({ path: path.join(media, "b.png") })
  await recPage.waitForTimeout(1300)
  const video = recPage.video()
  await rec.close()
  await video.saveAs(path.join(media, "video.webm"))

  for (const taskId of ["T001", "T002"]) {
    const dir = path.join(projectRuns, taskId, RUN)
    mkdirSync(dir, { recursive: true })
    for (const s of STEPS) copyFileSync(path.join(media, s.src), path.join(dir, s.screenshot))
    copyFileSync(path.join(media, "video.webm"), path.join(dir, "video.webm"))
    writeFileSync(path.join(dir, "run.json"), JSON.stringify({
      runId: RUN, taskId, project: projectKey, startedAt: "2026-10-05T10:00:00.000Z", endedAt: "2026-10-05T10:00:03.000Z",
      status: "passed", commit: null, video: "video.webm",
      steps: STEPS.map(({ src, ...s }, i) => ({ index: i + 1, status: "passed", error: null, ...s })),
    }))
  }

  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  const open = async (taskId) => {
    await page.goto(`${BASE}/manual-tests?tab=all&task=${taskId}&view=review`)
    await page.getByRole("combobox", { name: "Playback speed" }).waitFor()
    // the video's length is known once the player has probed it
    await page.waitForFunction(() => { const v = document.querySelector("video"); return !!v && Number.isFinite(v.duration) && v.duration > 0 })
  }
  const rate = () => page.locator("video").evaluate((v) => v.playbackRate)

  // S1: speed
  await open("T001")
  assert.equal(await page.getByRole("combobox", { name: "Playback speed" }).inputValue(), "1", "1× by default")
  assert.equal(await rate(), 1)
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("0.5")
  assert.equal(await rate(), 0.5)
  // it really plays slower: ~0.6s of wall time moves the video ~0.3s
  const moved = await page.locator("video").evaluate(async (v) => {
    v.currentTime = 0
    await v.play()
    const t0 = performance.now()
    await new Promise((r) => setTimeout(r, 600))
    v.pause()
    return v.currentTime / ((performance.now() - t0) / 1000)
  })
  assert.ok(moved > 0.3 && moved < 0.75, `video advanced at ${moved.toFixed(2)}× wall time`)
  await page.reload()
  await open("T001")
  assert.equal(await page.getByRole("combobox", { name: "Playback speed" }).inputValue(), "0.5", "0.5× after a reload")
  assert.equal(await rate(), 0.5)
  await open("T002")
  assert.equal(await rate(), 0.5, "another task's run keeps the speed")
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("2")
  assert.equal(await rate(), 2)
  console.log("ok  S1: 0.5× plays at half speed, survives a reload and another task's run; 2× works")

  // S2: auto-pause + caption (still at 2× from S1, so the run is quick)
  const pauseBox = page.getByRole("checkbox", { name: "Pause at each step" })
  assert.equal(await pauseBox.isChecked(), true, "auto-pause is on by default")
  const play = () => page.getByRole("button", { name: "Play" }).click()
  const pausedAt = () => page.waitForFunction(() => { const v = document.querySelector("video"); return v.paused && v.currentTime > 0 ? v.currentTime : null }).then((h) => h.jsonValue())
  await page.locator("video").evaluate((v) => { v.currentTime = 0 })
  await play()
  const first = await pausedAt()
  assert.ok(Math.abs(first - 1.06) < 0.02, `paused on step 1's frame (1.06s), at ${first}`)
  await page.getByText("Step 1", { exact: true }).waitFor()
  await page.getByText(STEPS[0].name).first().waitFor()
  await play()
  await page.waitForFunction(() => { const v = document.querySelector("video"); return v.paused && v.currentTime > 1.5 })
  const second = await page.locator("video").evaluate((v) => v.currentTime)
  assert.ok(Math.abs(second - 2.16) < 0.02, `Play went on to step 2's frame (2.16s), at ${second}`)
  await page.getByText("Step 2", { exact: true }).waitFor()
  await pauseBox.uncheck()
  await page.locator("video").evaluate((v) => { v.currentTime = 0 })
  await play()
  await page.waitForFunction(() => document.querySelector("video").ended, null, { timeout: 10000 })
  await page.reload()
  await open("T002")
  assert.equal(await page.getByRole("checkbox", { name: "Pause at each step" }).isChecked(), false, "off after a reload")
  console.log("ok  S2: stops on each step's frame with Step N · name, Play goes on, off plays through, kept after a reload")

  assert.deepEqual(errors, [], "no console errors")
} finally {
  await browser.close()
  rmSync(projectRuns, { recursive: true, force: true })
  rmSync(media, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
}
