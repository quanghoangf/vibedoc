// Browser check for R079 (watchable evidence videos) on a fixture project, one section per task:
//   S1 (T225): the run player's speed control → 0.5× plays at half speed (video.playbackRate), survives a reload
//              and a switch to another task's run.
//   S2 (T226): auto-pause (on by default) stops on each step's screenshot frame with "Step N · <name>" over the
//              video; Play goes on to the next step; off → plays through; the choice survives a reload.
//   S3/S4 (T228): the same kit spec run twice from the shell (as an agent does), presentation on and with
//              VIBEDOC_PRESENT=0 → both pass with the same assertion counts and byte-identical step screenshots, and
//              the presentation run is paced (each action waits out the annotation) with run.json presentation on.
//              T229: each presentation step opens with a chapter card (counted back from the video's frames: one per
//              step, none in the plain run), and holds before
//              its screenshot.
//              The cursor itself is only in the video frames: that stays a manual check.
//   S5 (T227): a plain run says why under the video (suite, CI, VIBEDOC_PRESENT=0, old Playwright); a presentation
//              run and a run from before R079 say nothing.
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/watchable-video.mjs
//
// Seeds timed runs (two steps with startMs/endMs, their screenshots and a ~2.4s webm recorded by this browser)
// under `$VIBEDOC_RUNS_DIR` (default ~/.vibedoc/runs; it must match the server's) in the fixture's own project
// folder, removed at the end. Only /api/projects is stubbed.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
for (const id of ["T001", "T002", "T003"]) {
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

  // T003: one run per presentation outcome, newest first in the player's run picker
  const PLAIN = {
    "20261005T100500Z": { on: false, reason: "suite" },
    "20261005T100400Z": { on: false, reason: "ci" },
    "20261005T100300Z": { on: false, reason: "disabled" },
    "20261005T100200Z": { on: false, reason: "old-playwright" },
    "20261005T100100Z": { on: true, reason: null },
  }
  const seedRun = (taskId, runId, extra) => {
    const dir = path.join(projectRuns, taskId, runId)
    mkdirSync(dir, { recursive: true })
    for (const s of STEPS) copyFileSync(path.join(media, s.src), path.join(dir, s.screenshot))
    copyFileSync(path.join(media, "video.webm"), path.join(dir, "video.webm"))
    writeFileSync(path.join(dir, "run.json"), JSON.stringify({
      runId, taskId, project: projectKey, startedAt: "2026-10-05T10:00:00.000Z", endedAt: "2026-10-05T10:00:03.000Z",
      status: "passed", commit: null, video: "video.webm",
      steps: STEPS.map(({ src, ...s }, i) => ({ index: i + 1, status: "passed", error: null, ...s })), ...extra,
    }))
  }
  for (const taskId of ["T001", "T002"]) seedRun(taskId, RUN, {})
  for (const [runId, presentation] of Object.entries(PLAIN)) seedRun("T003", runId, { presentation })

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

  // S5: why a video was recorded plain
  const WHY = {
    suite: "Recorded plain: the regression suite runs at full speed.",
    ci: "Recorded plain: runs in CI keep full speed.",
    disabled: "Recorded plain: VIBEDOC_PRESENT=0 turned the cursor and chapters off.",
    "old-playwright": "Recorded plain: the app's Playwright is older than 1.59, which has no cursor or chapters.",
  }
  await open("T003")
  for (const [runId, p] of Object.entries(PLAIN)) {
    await page.getByRole("combobox", { name: "Run", exact: true }).selectOption(runId)
    if (p.on) assert.equal(await page.getByText(/^Recorded plain/).count(), 0, "a presentation run says nothing")
    else await page.getByText(WHY[p.reason], { exact: true }).waitFor()
  }
  await open("T001")
  assert.equal(await page.getByText(/^Recorded plain/).count(), 0, "a run from before R079 says nothing")
  console.log("ok  S5: plain runs say why (suite, CI, VIBEDOC_PRESENT=0, old Playwright); presentation and older runs say nothing")

  // S3/S4: a real kit run, presentation vs plain
  const { FIXTURE_KIT_FILES } = await import("../src/lib/frontend.ts")
  const app = mkdtempSync(path.join(tmpdir(), "vibedoc-present-"))
  const runsTmp = mkdtempSync(path.join(tmpdir(), "vibedoc-present-runs-"))
  try {
    symlinkSync(path.join(process.cwd(), "node_modules"), path.join(app, "node_modules"))
    for (const file of FIXTURE_KIT_FILES) {
      mkdirSync(path.dirname(path.join(app, "e2e/vibedoc/kit", file)), { recursive: true })
      copyFileSync(path.join("src", file), path.join(app, "e2e/vibedoc/kit", file))
    }
    writeFileSync(path.join(app, "e2e/vibedoc/T009-show.spec.ts"), `
import { test, expect } from './kit/testing/playwright-fixture'
test.use({ vibedocTask: 'T009', viewport: { width: 480, height: 320 } })
test('T009', async ({ page, step }) => {
  await step('Click Go → it reads Done', async () => {
    // goto, not setContent: setContent removes Playwright's overlay for good (see the fixture)
    await page.goto('data:text/html,' + encodeURIComponent('<button onclick="this.textContent = \\'Done\\'" style="margin:40px;font:20px sans-serif">Go</button><input aria-label="Name" style="font:20px sans-serif">'))
    await page.getByRole('button', { name: 'Go' }).click()
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  })
  await step('Type a name → the field holds it', async () => {
    await page.getByLabel('Name').fill('Ada')
    await expect(page.getByLabel('Name')).toHaveValue('Ada')
  })
})
`)
    const runOnce = (extra) => {
      execFileSync(path.join(app, "node_modules/.bin/playwright"), ["test", "e2e/vibedoc/T009-show.spec.ts", "--reporter=line"], {
        cwd: app, stdio: "pipe", env: { ...process.env, CI: "", VIBEDOC_RUNS_DIR: runsTmp, ...extra },
      })
      const dir = path.join(runsTmp, readdirSync(runsTmp)[0], "T009")
      const id = readdirSync(dir).filter((d) => /^\d{8}T\d{6}Z$/.test(d)).sort().at(-1)
      return { dir: path.join(dir, id), run: JSON.parse(readFileSync(path.join(dir, id, "run.json"), "utf8")) }
    }
    const plain = runOnce({ VIBEDOC_PRESENT: "0" })
    const shown = runOnce({})
    assert.deepEqual(plain.run.presentation, { on: false, reason: "disabled" })
    assert.deepEqual(shown.run.presentation, { on: true, reason: null })
    assert.equal(shown.run.status, "passed")
    assert.equal(plain.run.status, "passed")
    for (const [i, s] of shown.run.steps.entries()) {
      const p = plain.run.steps[i]
      assert.deepEqual(s.assertions, p.assertions, `step ${s.index}: same assertion counts`)
      assert.ok(readFileSync(path.join(shown.dir, s.screenshot)).equals(readFileSync(path.join(plain.dir, p.screenshot))), `step ${s.index}: screenshot identical to the plain run's (no cursor or highlight)`)
      const slower = (s.endMs - s.startMs) - (p.endMs - p.startMs)
      // chapter (900ms) + hold (700ms) + the action annotation (600ms)
      assert.ok(slower >= 1800, `step ${s.index}: chapter, action pacing and hold (${slower}ms slower than plain)`)
    }
    // The chapter cards in the video: frames where the card's grey band sits mid-frame, counted per appearance
    const chapters = async (dir) => {
      const p = await browser.newPage({ viewport: { width: 480, height: 320 } })
      await p.goto(`file://${path.join(dir, "video.webm")}`)
      await p.waitForFunction(() => document.querySelector("video")?.readyState >= 1)
      await p.evaluate(() => { const v = document.querySelector("video"); v.controls = false; v.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain" })
      const dur = await p.evaluate(() => new Promise((r) => { const v = document.querySelector("video"); if (Number.isFinite(v.duration)) r(v.duration); else { v.ondurationchange = () => Number.isFinite(v.duration) && r(v.duration); v.currentTime = 1e9 } }))
      let n = 0, prev = false
      for (let t = 0; t <= dur; t += 0.2) {
        await p.evaluate((t) => new Promise((r) => { const v = document.querySelector("video"); v.pause(); v.onseeked = r; v.currentTime = t }), t)
        const band = await p.screenshot({ clip: { x: 0, y: 140, width: 480, height: 40 } })
        const dark = await p.evaluate(async (b64) => {
          const i = new Image(); i.src = `data:image/png;base64,${b64}`; await i.decode()
          const c = document.createElement("canvas"); c.width = i.width; c.height = i.height
          const g = c.getContext("2d"); g.drawImage(i, 0, 0)
          const d = g.getImageData(0, 0, c.width, c.height).data
          let k = 0
          for (let j = 0; j < d.length; j += 4) if (d[j] < 120 && Math.abs(d[j] - d[j + 2]) < 10) k++
          return k
        }, band.toString("base64"))
        const on = dark > 2000
        if (on && !prev) n++
        prev = on
      }
      await p.close()
      return n
    }
    assert.equal(await chapters(shown.dir), shown.run.steps.length, "one chapter card per step in the presentation video")
    assert.equal(await chapters(plain.dir), 0, "no chapter card in the plain video")
    console.log("ok  S3/S4: presentation run has chapters, pacing and holds and says on; screenshots and assertion counts match the plain run")
  } finally {
    rmSync(app, { recursive: true, force: true })
    rmSync(runsTmp, { recursive: true, force: true })
  }

  assert.deepEqual(errors, [], "no console errors")
} finally {
  await browser.close()
  rmSync(projectRuns, { recursive: true, force: true })
  rmSync(media, { recursive: true, force: true })
  rmSync(fx, { recursive: true, force: true })
}
