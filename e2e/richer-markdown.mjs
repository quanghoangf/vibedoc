// Browser check for R089 (Richer markdown) on a fixture doc in the /docs preview:
//   S1. the five GFM alerts render as labelled callouts; WARNING's colour follows the light / dark theme
//   S2. a "pnpm" and an "npm" titled fence in a row render as one tab group; click and arrow keys switch tabs
//   S3. a <details> block renders collapsed with a styled summary row that opens on click / Enter / Space
// Fails on any browser console error. The fixture is a fresh mktemp project.
//
//   PORT=3189 pnpm dev   # then:
//   BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/richer-markdown.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3189"
const fx = makeFixture()
const write = (f, s) => {
  mkdirSync(path.dirname(path.join(fx, f)), { recursive: true })
  writeFileSync(path.join(fx, f), s)
}
const KINDS = ["note", "tip", "important", "warning", "caution"]
write("docs/rich.md", [
  "# Rich",
  "",
  ...KINDS.flatMap((k) => [`> [!${k.toUpperCase()}]`, `> The ${k} body.`, ""]),
  "> A plain quote.",
  "",
  '```bash title="pnpm"', "pnpm add vibedoc", "```",
  "",
  '```bash title="npm"', "npm install vibedoc", "```",
  "",
  "```bash", "echo untitled", "```",
  "",
  "<details>", "<summary>More</summary>", "", "- hidden one", "- hidden two", "", "</details>",
  "",
].join("\n"))

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/rich.md")}`)
  const doc = page.locator(".doc-preview")

  // S1: each alert is a callout with its label and body; the plain quote stays a blockquote
  for (const k of KINDS) {
    const alert = doc.locator(`[data-alert="${k}"]`)
    await alert.waitFor()
    assert.equal(await alert.getAttribute("role"), "note")
    assert.equal(await alert.locator(".md-alert-title").textContent(), k[0].toUpperCase() + k.slice(1))
    assert.equal((await alert.locator("p").nth(1).textContent()).trim(), `The ${k} body.`)
  }
  assert.equal(await doc.locator("blockquote").count(), 1, "only the plain quote is a blockquote")
  assert.equal(await doc.getByText("[!", { exact: false }).count(), 0, "no raw markers left")
  const colours = await doc.evaluate((root) => {
    const read = () => Object.fromEntries(Array.from(root.querySelectorAll("[data-alert]"))
      .map((el) => [el.getAttribute("data-alert"), getComputedStyle(el).borderLeftColor]))
    const html = document.documentElement
    const wasDark = html.classList.contains("dark")
    html.classList.add("dark")
    const dark = read()
    html.classList.remove("dark")
    const light = read()
    html.classList.toggle("dark", wasDark)
    return { dark, light }
  })
  for (const mode of ["dark", "light"]) {
    assert.equal(new Set(Object.values(colours[mode])).size, 5, `${mode}: five distinct alert colours`)
  }
  assert.notEqual(colours.dark.warning, colours.light.warning, "warning follows the theme")
  console.log("ok  S1: five alerts render as labelled callouts, coloured per kind in light and dark")

  // S2: one tablist with pnpm + npm; click and arrow keys switch the visible code, focus follows
  const group = doc.locator("[data-code-group]")
  assert.equal(await group.count(), 1, "one code group")
  assert.deepEqual(await group.getByRole("tab").allTextContents(), ["pnpm", "npm"])
  const pnpm = group.getByRole("tab", { name: "pnpm", exact: true })
  const npm = group.getByRole("tab", { name: "npm", exact: true })
  const shown = async () => (await group.getByRole("tabpanel").textContent()).trim()
  assert.equal(await pnpm.getAttribute("aria-selected"), "true")
  assert.equal(await shown(), "pnpm add vibedoc")
  const controls = await pnpm.getAttribute("aria-controls")
  assert.ok(controls && (await page.locator(`[id="${controls}"]`).textContent()).includes("pnpm add"), "aria-controls points at its panel")
  await npm.click()
  assert.equal(await npm.getAttribute("aria-selected"), "true")
  assert.equal(await pnpm.getAttribute("aria-selected"), "false")
  assert.equal(await shown(), "npm install vibedoc")
  await page.keyboard.press("ArrowLeft")
  assert.equal(await pnpm.getAttribute("aria-selected"), "true")
  assert.ok(await pnpm.evaluate((el) => el === document.activeElement), "focus follows the arrow key")
  assert.equal(await shown(), "pnpm add vibedoc")
  await page.keyboard.press("ArrowLeft") // wraps to the last tab
  assert.equal(await npm.getAttribute("aria-selected"), "true")
  await page.keyboard.press("Home")
  assert.equal(await pnpm.getAttribute("aria-selected"), "true")
  assert.equal(await pnpm.getAttribute("tabindex"), "0")
  assert.equal(await npm.getAttribute("tabindex"), "-1")
  assert.equal(await doc.locator("pre").filter({ hasText: "echo untitled" }).count(), 1, "an untitled fence stays a plain block")
  console.log("ok  S2: pnpm/npm fences are one tab group; click, ArrowLeft (wrapping) and Home switch it, focus follows")

  // S3: details starts closed with a styled summary row; click and the keyboard open / close it
  const details = doc.locator("details")
  const summary = details.locator("summary")
  const hidden = details.getByText("hidden one")
  assert.equal(await details.getAttribute("open"), null, "collapsed by default")
  assert.equal(await hidden.isVisible(), false)
  assert.equal(await summary.evaluate((el) => getComputedStyle(el).cursor), "pointer")
  assert.equal(await summary.evaluate((el) => getComputedStyle(el, "::before").content), '""', "chevron drawn")
  await summary.click()
  await hidden.waitFor()
  assert.equal(await details.getAttribute("open"), "")
  assert.equal(await details.locator("ul > li").count(), 2, "markdown inside renders")
  await summary.focus()
  await page.keyboard.press("Enter")
  await hidden.waitFor({ state: "hidden" })
  await page.keyboard.press("Space")
  await hidden.waitFor()
  console.log("ok  S3: details renders collapsed with a styled summary; click, Enter and Space toggle it")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nricher-markdown: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
