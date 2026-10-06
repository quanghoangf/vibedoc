// Browser check for R078 (i18n support) on a fixture project:
//   1. Settings → Appearance → Language → Tiếng Việt switches the UI at once (no reload), <html lang="vi">.
//   2. Every page in PAGES shows no English UI text: visible text and title / aria-label / placeholder are compared
//      with every English message (src/i18n/*.ts) whose Vietnamese differs. Messages with {placeholders} are matched
//      as patterns. User content, ids and keys aren't messages, so they never count.
//   3. A reload stays Vietnamese, and the server already renders lang="vi" (no English flash).
//   4. Switching back to English restores it without a reload.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
//
// Each R078 area task adds its pages to PAGES (`open` shows panels/dialogs whose text should be checked too).
import assert from "node:assert/strict"
import { readdirSync, rmSync } from "node:fs"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()

// `scope`: CSS selectors to check instead of the whole page (the shell while page content isn't translated yet)
/** @type {{ path: string, name: string, scope?: string, open?: (page: import("playwright").Page) => Promise<void> }[]} */
const PAGES = [
  { path: "/board", name: "app shell on /board", scope: 'header.sticky, [data-sidebar="sidebar"], [aria-keyshortcuts="?"]',
    // the Help panel's content (page title, keys, tips) is src/lib/shortcuts.ts: T223 opens it
  },
]

// English messages that differ in Vietnamese → a matcher per message
const dir = new URL("../src/i18n/", import.meta.url)
const english = []
for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const { en, vi } = await import(new URL(file, dir).href)
  for (const [k, v] of Object.entries(en)) {
    if (v === vi[k]) continue
    const pattern = v.includes("{")
      ? new RegExp(`^${v.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{\w+\\?\}/g, ".+")}$`)
      : null
    english.push({ key: `${file.slice(0, -3)}.${k}`, text: v, pattern })
  }
}
const isEnglish = (s) => english.find((m) => (m.pattern ? m.pattern.test(s) : m.text === s))

/** Visible text nodes + the text-like attributes of visible elements. */
async function uiStrings(page, scope) {
  return page.evaluate((scope) => {
    const out = new Set()
    const visible = (el) => el && el.checkVisibility({ visibilityProperty: true }) !== false
    const roots = scope ? [...document.querySelectorAll(scope)] : [document.body]
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = n.textContent.replace(/\s+/g, " ").trim()
        const el = n.parentElement
        if (s && el && !el.closest("script,style") && (visible(el) || el.closest(".sr-only"))) out.add(s)
      }
    }
    for (const el of roots.flatMap((r) => [r, ...r.querySelectorAll("[title],[aria-label],[placeholder]")])) {
      for (const a of ["title", "aria-label", "placeholder"]) {
        const v = el.getAttribute(a)?.trim()
        if (v) out.add(v)
      }
    }
    return [...out]
  }, scope)
}

async function assertVietnamese(page, name, scope) {
  const left = (await uiStrings(page, scope)).map((s) => [s, isEnglish(s)]).filter(([, m]) => m)
  assert.deepEqual(left.map(([s, m]) => `${s}  (${m.key})`), [], `${name}: English UI text left in Vietnamese`)
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Switch in Settings, no reload
  await page.goto(`${BASE}/settings`)
  await page.getByRole("radio", { name: "Tiếng Việt" }).click()
  await page.evaluate(() => { window.__noReload = true })
  await page.getByRole("link", { name: "Bảng" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "vi")
  assert.equal(await page.getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked"), "true")
  assert.equal(await page.evaluate(() => window.__noReload), true, "switching doesn't reload")
  console.log("ok  Settings → Tiếng Việt switches the sidebar at once, <html lang=vi>")

  // 2. No English left on each page
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`)
    await page.getByRole("link", { name: "Bảng" }).first().waitFor()
    await page.waitForLoadState("networkidle")
    if (p.open) await p.open(page)
    await assertVietnamese(page, p.name, p.scope)
    console.log(`ok  ${p.name}: no English UI text`)
  }

  // 3. Reload keeps it; the server renders it (first paint is already Vietnamese)
  await page.reload()
  await page.getByRole("link", { name: "Bảng" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "vi")
  const html = await (await page.request.get(`${BASE}/board`, { headers: { cookie: "vibedoc-lang=vi" } })).text()
  // the server sends the loading screen; the provider gets the language with it, so the shell renders vi from the start
  assert.ok(/<html[^>]* lang="vi"/.test(html), "server HTML has lang=vi")
  const plain = await (await page.request.get(`${BASE}/board`, { headers: { cookie: "vibedoc-lang=xx" } })).text()
  assert.ok(/<html[^>]* lang="en"/.test(plain), "an unknown cookie value → English")
  console.log("ok  reload stays Vietnamese; the server renders lang=vi; a bad cookie → English")

  // 4. Back to English without a reload
  await page.goto(`${BASE}/settings`)
  await page.evaluate(() => { window.__noReload = true })
  await page.getByRole("radio", { name: "English" }).click()
  await page.getByRole("link", { name: "Board" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "en")
  assert.equal(await page.evaluate(() => window.__noReload), true, "switching back doesn't reload")
  console.log("ok  English again without a reload")

  assert.deepEqual(errors, [], "no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
