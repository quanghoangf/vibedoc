// Browser check for R096 (Visual docs) on fixture docs in the /docs preview:
//   S3. a list under <!-- vibedoc:steps --> renders N cards with N−1 arrows, one under <!-- vibedoc:cards --> a grid
//       (one column at 390px, no page overflow); /md/<path> and GitHub (gh api /markdown, skipped when gh isn't
//       logged in) still show the plain list
// Fails on any browser console error. The fixture is a fresh mktemp project. Later R096 tasks add sections.
//
//   PORT=3189 pnpm dev   # then:
//   BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/visual-docs.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3189"
const fx = makeFixture()
const write = (f, s) => {
  mkdirSync(path.dirname(path.join(fx, f)), { recursive: true })
  writeFileSync(path.join(fx, f), s)
}
const BLOCKS = [
  "# Blocks",
  "",
  "<!-- vibedoc:steps -->",
  "1. **Focus** — One main goal at a time.",
  "   Example: finish the transaction flow.",
  "2. **Queue** — New asks go to a queue.",
  "3. **Ship** — Small and often.",
  "",
  "<!-- vibedoc:cards -->",
  "",
  "- **🧭 Map** — See the whole plan.",
  "- **Docs** — Read what was decided.",
  "- **Tests** — Prove it works.",
  "- **Memory** — Remember why.",
  "",
  "A list without a marker:",
  "",
  "- plain one",
  "- [ ] a task",
  "",
].join("\n")
write("docs/blocks.md", BLOCKS)

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blocks.md")}`)
  const doc = page.locator(".doc-preview")

  // S3 steps: three cards in an <ol>, two arrows between them, title / body / detail split
  const steps = doc.locator('[data-visual="steps"]')
  await steps.waitFor()
  assert.equal(await steps.getByRole("list").count(), 1, "list semantics kept")
  assert.equal(await steps.locator("ol > li").count(), 3)
  assert.equal(await steps.locator(".md-visual-card").count(), 3)
  assert.equal(await steps.locator(".md-visual-arrow").count(), 2, "N−1 arrows")
  assert.equal(await steps.locator(".md-visual-title").first().textContent(), "Focus")
  assert.equal(await steps.locator(".md-visual-body").first().textContent(), "One main goal at a time.")
  assert.equal((await steps.locator(".md-visual-detail").first().textContent()).trim(), "Example: finish the transaction flow.")
  const [cardTop, arrowTop, nextTop] = await steps.evaluate((el) => [".md-visual-card", ".md-visual-arrow"]
    .map((s) => el.querySelector(s).getBoundingClientRect().top).concat(el.querySelectorAll(".md-visual-card")[1].getBoundingClientRect().top))
  assert.ok(cardTop < arrowTop && arrowTop < nextTop, "cards stack with the arrow between them")
  // card border = the rule-line token, arrow = Pencil Grey, in light and in dark
  const look = await steps.evaluate((root) => {
    const read = () => ({
      border: getComputedStyle(root.querySelector(".md-visual-card")).borderTopColor,
      arrow: getComputedStyle(root.querySelector(".md-visual-arrow")).color,
      rule: getComputedStyle(document.documentElement).getPropertyValue("--rgb-border").trim(),
      grey: getComputedStyle(document.documentElement).getPropertyValue("--rgb-muted").trim(),
    })
    const html = document.documentElement
    const wasDark = html.classList.contains("dark")
    html.classList.add("dark")
    const dark = read()
    html.classList.remove("dark")
    const light = read()
    html.classList.toggle("dark", wasDark)
    return { dark, light }
  })
  const rgb = (triplet) => `rgb(${triplet.split(/\s+/).join(", ")})`
  for (const mode of ["dark", "light"]) {
    assert.equal(look[mode].border, rgb(look[mode].rule), `${mode}: card border is the rule line`)
    assert.equal(look[mode].arrow, rgb(look[mode].grey), `${mode}: arrow is Pencil Grey`)
  }
  assert.notEqual(look.dark.border, look.light.border, "cards follow the theme")
  console.log("ok  S3: a steps block renders 3 cards with 2 arrows, rule-line borders and Pencil Grey arrows in light and dark")

  // S3 cards: a grid of four cards, the icon kept; the unmarked list and the task list stay plain lists
  const cards = doc.locator('[data-visual="cards"]')
  assert.equal(await cards.locator(".md-visual-card").count(), 4)
  assert.equal(await cards.locator(".md-visual-arrow").count(), 0)
  assert.equal(await cards.locator(".md-visual-icon").textContent(), "🧭")
  assert.equal(await cards.locator("ul").evaluate((el) => getComputedStyle(el).display), "grid")
  const tops = await cards.locator(".md-visual-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  assert.ok(new Set(tops).size < tops.length, "cards share a row on desktop")
  assert.equal(await doc.locator("ul:not([role]) > li").filter({ hasText: "plain one" }).count(), 1, "unmarked list unchanged")
  assert.equal(await doc.locator('input[type="checkbox"]').count(), 1, "task list item unchanged")
  console.log("ok  S3: a cards block renders a 4-card grid; lists without a marker render as before")

  // S3 at 390px: cards are one column, no horizontal page scroll
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blocks.md")}`)
  await cards.waitFor()
  const lefts = await cards.locator(".md-visual-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
  assert.equal(new Set(lefts).size, 1, "one column at 390px")
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal page scroll at 390px")
  console.log("ok  S3: at 390px the cards are one column without page overflow")

  // S3: the agent view keeps the comment and the plain list
  const res = await fetch(`${BASE}/md/docs/blocks.md?root=${encodeURIComponent(fx)}`)
  assert.equal(res.status, 200)
  const raw = await res.text()
  assert.match(raw, /<!-- vibedoc:steps -->\n1\. \*\*Focus\*\* — One main goal at a time\.\n {3}Example/)
  assert.match(raw, /<!-- vibedoc:cards -->\n\n- \*\*🧭 Map\*\*/)
  console.log("ok  S3: /md/docs/blocks.md still has the markers and the plain lists")

  let gh = null
  try {
    gh = execFileSync("gh", ["api", "-X", "POST", "/markdown", "-f", "mode=gfm", "-f", `text=${BLOCKS}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    console.log("skip GitHub render check: `gh api /markdown` unavailable (not logged in or offline)")
  }
  if (gh) {
    assert.match(gh, /<ol[^>]*>\s*<li[^>]*><strong>Focus<\/strong> — One main goal at a time\./, "GitHub shows a numbered list")
    assert.doesNotMatch(gh, /vibedoc:steps/, "the marker never shows as text")
    console.log("ok  S3: GitHub renders the same file as a numbered list and a bullet list")
  }

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nvisual-docs: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
