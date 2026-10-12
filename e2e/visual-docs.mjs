// Browser check for R096 (Visual docs) on fixture docs in the /docs preview:
//   T513. a flowchart, a sequence and a state diagram render in VibeDoc's tokens (node stroke = the rule-line token,
//         the `accent` class = the accent) in light and in dark, and a theme switch re-colours them without a reload;
//         a broken diagram shows its error and source inline while the others still render; typing in the Split
//         editor re-renders the preview's diagram
//   S2 (T514). hover/Tab shows a diagram's Fullscreen · Copy source toolbar; fullscreen zooms with + / wheel, drag pans,
//       Fit resets, Esc closes and focus returns to the button; Copy source puts the ```mermaid fence on the clipboard
//   S3. a list under <!-- vibedoc:steps --> renders N cards with N−1 arrows, one under <!-- vibedoc:cards --> a grid
//       (one column at 390px, no page overflow); /md/<path> and GitHub (gh api /markdown, skipped when gh isn't
//       logged in) still show the plain list
//   S3 (T516). <!-- vibedoc:compare --> renders 2 columns side by side at 1400px and stacked at 390px; a 4-item compare
//       falls back to cards; <!-- vibedoc:timeline --> renders a dot per item with the accent only on "Now"
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
const BROKEN = "flowchart LR\n  A --> -->"
write("docs/diagrams.md", [
  "# Diagrams",
  "",
  "```mermaid", "flowchart LR", "  A[Request] --> B[Core]", "  B --> C[(Files)]", "  class B accent", "```",
  "",
  "```mermaid", "sequenceDiagram", "  Agent->>MCP: tools/call", "  MCP-->>Agent: result", "```",
  "",
  "```mermaid", "stateDiagram-v2", "  [*] --> todo", "  todo --> done", "```",
  "",
  "```mermaid", BROKEN, "```",
  "",
].join("\n"))

write("docs/live.md", "# Live\n\n```mermaid\nflowchart LR\n  A --> B\n```\n")

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

write("docs/compare.md", [
  "# Compare", "",
  "<!-- vibedoc:compare -->", "- **Mermaid** — text in the doc", "  - diffs and agents read it", "  - less design freedom",
  "- **HTML/SVG** — a separate file", "  - publish-quality", "",
  "<!-- vibedoc:compare -->", "- a", "- b", "- c", "- d", "",
  "<!-- vibedoc:timeline -->", "1. **2026 Q3** — R089 richer markdown", "2. **Now** — R096 visual docs", "3. **Next** — R097 diagrams from data", "4. **Later** — more", "",
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
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/diagrams.md")}`)
  const doc = page.locator(".doc-preview")
  await doc.locator(".mermaid > svg").nth(2).waitFor()

  // the broken one: error message + its source in place; the three valid ones are svgs
  const error = doc.locator(".mermaid-error")
  await error.waitFor()
  assert.equal(await error.getAttribute("role"), "note")
  assert.equal(await doc.locator(".mermaid > svg").count(), 3, "the valid diagrams still render")
  assert.equal((await error.locator("pre").textContent()).trim(), BROKEN, "the source is shown")
  assert.match(await error.locator(".mermaid-error-message").textContent(), /^Parse error on line 2: Expecting /, "the error says where and what")
  assert.equal(await page.locator("body > [id^=dmermaid], body > svg[id^=mermaid]").count(), 0, "no stray error graphic left on the page")
  console.log("ok  broken diagram: error and source inline, the other three render")

  // stroke of the flowchart's plain node and the accent node vs the tokens, as the browser computes both
  const read = () => doc.evaluate((root) => {
    const rgb = (v) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(/\s+/).join(", ")})`
    const shape = (n) => root.querySelector(`.mermaid svg .node[id*="-${n}-"] :is(rect, path, polygon)`)
    const actor = root.querySelector(".mermaid svg rect.actor")
    const state = root.querySelector(".mermaid svg .node rect, .mermaid svg g.stateGroup rect")
    return {
      rule: rgb("--rgb-border2"), accent: rgb("--rgb-accent"), ink: rgb("--rgb-txt"),
      plain: getComputedStyle(shape("A")).stroke,
      hot: getComputedStyle(shape("B")).stroke,
      actor: actor && getComputedStyle(actor).stroke,
      state: state && getComputedStyle(state).stroke,
      label: getComputedStyle(root.querySelector(".mermaid svg .nodeLabel, .mermaid svg .node text")).color,
      svgBg: getComputedStyle(root.querySelector(".mermaid > svg")).backgroundColor,
      shadows: Array.from(root.querySelectorAll(".mermaid svg *")).filter((el) => getComputedStyle(el).filter !== "none").length,
    }
  })
  const check = (s, mode) => {
    assert.equal(s.plain, s.rule, `${mode}: flowchart node stroke = rule line`)
    assert.equal(s.hot, s.accent, `${mode}: class accent = the accent`)
    assert.equal(s.actor, s.rule, `${mode}: sequence actor stroke = rule line`)
    assert.equal(s.state, s.rule, `${mode}: state stroke = rule line`)
    assert.equal(s.label, s.ink, `${mode}: labels in ink`)
    assert.equal(s.svgBg, "rgba(0, 0, 0, 0)", `${mode}: the page shows through`)
    assert.equal(s.shadows, 0, `${mode}: no drop shadows`)
  }
  const startDark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
  const first = await read()
  check(first, startDark ? "dark" : "light")

  // switch theme the way the app does (the class on <html>): the diagrams re-colour, no reload
  await page.evaluate(() => { window.__noReload = true; document.documentElement.classList.toggle("dark") })
  await page.waitForFunction((before) => {
    const n = document.querySelector('.doc-preview .mermaid svg .node[id*="-A-"] :is(rect, path, polygon)')
    return n && getComputedStyle(n).stroke !== before
  }, first.plain)
  const second = await read()
  check(second, startDark ? "light" : "dark")
  assert.notEqual(second.rule, first.rule, "the rule line differs between themes")
  assert.equal(await page.evaluate(() => window.__noReload), true, "no reload")
  assert.equal(await doc.locator(".mermaid > svg").count(), 3)
  assert.equal(await doc.locator(".mermaid-error").count(), 1, "the broken one stays an error after the switch")
  console.log("ok  T513: flowchart, sequence and state diagrams follow the tokens in light and dark; a switch re-colours them")

  // S2 (T514): the diagram toolbar, fullscreen zoom/pan, copy source
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] })
    const p2 = await ctx.newPage()
    p2.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
    p2.on("pageerror", (e) => errors.push(e.message))
    await stubChat(p2, [], { root: fx })
    await p2.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/diagrams.md")}`)
    const first = p2.locator(".doc-preview .mermaid").first()
    await first.locator(":scope > svg").waitFor()
    const full = first.getByRole("button", { name: "Open diagram fullscreen" })
    assert.equal(await full.evaluate((b) => getComputedStyle(b.parentElement).opacity), "0", "toolbar hidden until hover")
    await first.hover()
    await p2.waitForFunction(() => getComputedStyle(document.querySelector(".doc-preview .diagram-tools")).opacity === "1")
    assert.equal(await p2.locator(".doc-preview .mermaid-error .diagram-tools").count(), 0, "no toolbar on a broken diagram")

    // keyboard: focus the button, Enter opens the viewer
    await full.focus()
    await p2.keyboard.press("Enter")
    const viewer = p2.locator("[data-diagram-viewer]")
    // the dialog zooms/slides in: measure only after its animations end
    const settle = () => viewer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    await viewer.waitFor()
    await settle()
    assert.equal(await viewer.getByRole("heading", { name: "Diagram" }).count() + await viewer.getByText("Diagram", { exact: true }).count() > 0, true)
    const scale = viewer.locator("[data-diagram-scale]")
    const stage = viewer.locator("[data-diagram-stage]")
    assert.equal(await scale.textContent(), "100%")
    const strokes = await stage.evaluate((el) => {
      const shape = (n) => getComputedStyle(el.querySelector(`.node[id*="-${n}-"] :is(rect, path, polygon)`)).stroke
      return { plain: shape("A"), hot: shape("B"), accent: `rgb(${getComputedStyle(document.documentElement).getPropertyValue("--rgb-accent").trim().split(/\s+/).join(", ")})` }
    })
    assert.ok(strokes.hot === strokes.accent && strokes.plain !== strokes.accent, "the accent node keeps the accent in the viewer")
    await p2.keyboard.press("+")
    assert.equal(await scale.textContent(), "125%", "+ zooms in")
    const t0 = await stage.evaluate((el) => el.style.transform)
    const box = await viewer.locator(".diagram-stage").boundingBox()
    await p2.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await p2.mouse.down()
    await p2.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 6 })
    await p2.mouse.up()
    assert.notEqual(await stage.evaluate((el) => el.style.transform), t0, "drag pans")
    await p2.mouse.move(box.x + 200, box.y + 200)
    await p2.mouse.wheel(0, -300)
    await p2.waitForFunction(() => document.querySelector("[data-diagram-scale]").textContent !== "125%")
    await viewer.getByRole("button", { name: "Fit" }).click()
    assert.equal(await scale.textContent(), "100%", "Fit resets")
    await p2.keyboard.press("Escape")
    await viewer.waitFor({ state: "detached" })
    assert.equal(await p2.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open diagram fullscreen", "focus returns to the button")
    console.log("ok  S2: fullscreen opens by keyboard, + and wheel zoom, drag pans, Fit resets, Esc closes and returns focus")

    await first.hover()
    await first.getByRole("button", { name: "Copy diagram source" }).click()
    await p2.getByText("Copied the diagram source").waitFor()
    const clip = await p2.evaluate(() => navigator.clipboard.readText())
    assert.equal(clip, "```mermaid\nflowchart LR\n  A[Request] --> B[Core]\n  B --> C[(Files)]\n  class B accent\n```\n")
    console.log("ok  S2: Copy source puts the mermaid fence on the clipboard")

    // phone: the viewer fills the screen and the zoom buttons are there
    await p2.setViewportSize({ width: 390, height: 844 })
    await first.getByRole("button", { name: "Open diagram fullscreen" }).click()
    await viewer.waitFor()
    await settle()
    const vb = await viewer.boundingBox()
    assert.ok(vb.width >= 389 && vb.height >= 840, `viewer fills the phone screen (${vb.width}x${vb.height})`)
    assert.ok(await viewer.getByRole("button", { name: "Zoom in" }).isVisible())
    console.log("ok  S2: on a phone the viewer fills the screen with zoom buttons")
    await ctx.close()
  }

  // live editor preview: typing a new node re-renders the diagram after the debounce, themed, and never as an error
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/live.md")}`)
  await page.getByRole("tab", { name: "Split" }).click()
  const preview = page.locator(".doc-preview")
  await preview.locator(".mermaid > svg").waitFor()
  await page.locator(".cm-content").getByText("A --> B").click()
  await page.keyboard.press("End")
  await page.keyboard.type(" --> Cnew", { delay: 30 })
  await preview.locator(".mermaid svg .node").filter({ hasText: "Cnew" }).waitFor()
  assert.equal(await preview.locator(".mermaid-error").count(), 0, "a finished edit leaves no error box")
  assert.equal(await preview.locator(".mermaid > svg").count(), 1)
  console.log("ok  live preview: typing re-renders the diagram after the debounce")

  // S3 visual blocks (T515)
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blocks.md")}`)
  await page.setViewportSize({ width: 1280, height: 900 })

  // S3 steps: three cards in an <ol>, two arrows between them, title / body / detail split
  const steps = preview.locator('[data-visual="steps"]')
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
  const cards = preview.locator('[data-visual="cards"]')
  assert.equal(await cards.locator(".md-visual-card").count(), 4)
  assert.equal(await cards.locator(".md-visual-arrow").count(), 0)
  assert.equal(await cards.locator(".md-visual-icon").textContent(), "🧭")
  assert.equal(await cards.locator("ul").evaluate((el) => getComputedStyle(el).display), "grid")
  const tops = await cards.locator(".md-visual-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  assert.ok(new Set(tops).size < tops.length, "cards share a row on desktop")
  assert.equal(await preview.locator("ul:not([role]) > li").filter({ hasText: "plain one" }).count(), 1, "unmarked list unchanged")
  assert.equal(await preview.locator('input[type="checkbox"]').count(), 1, "task list item unchanged")
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

  // S3 (T516): compare side by side on desktop, stacked on phones; >3 items → cards; timeline dots, one accent
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/compare.md")}`)
  const compare = preview.locator('[data-visual="compare"]')
  await compare.waitFor()
  assert.equal(await compare.count(), 1, "the 4-item compare is not a compare")
  assert.equal(await preview.locator('[data-visual="cards"] .md-visual-card').count(), 4, "4-item compare falls back to cards")
  const colTops = async () => compare.locator(".md-visual-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  const colLefts = async () => compare.locator(".md-visual-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
  let [t1, t2] = await colTops()
  let [l1, l2] = await colLefts()
  assert.ok(t1 === t2 && l2 > l1 + 100, "two columns side by side at 1400px")
  assert.equal(await compare.locator(".md-visual-detail li").count(), 3, "nested points kept")
  const timeline = preview.locator('[data-visual="timeline"]')
  assert.equal(await timeline.locator(".md-visual-dot").count(), 4)
  assert.equal(await timeline.locator("li[data-now]").count(), 1)
  const dots = await timeline.locator(".md-visual-dot").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
  const accent = await page.evaluate(() => `rgb(${getComputedStyle(document.documentElement).getPropertyValue("--rgb-accent").trim().split(/\s+/).join(", ")})`)
  assert.deepEqual(dots.map((c) => c === accent), [false, true, false, false], "only the Now dot is the accent")
  await page.setViewportSize({ width: 390, height: 844 })
  ;[t1, t2] = await colTops()
  ;[l1, l2] = await colLefts()
  assert.ok(t2 > t1 && l1 === l2, "compare stacks at 390px")
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal page scroll at 390px")
  console.log("ok  S3: compare is 2 columns (stacked at 390px, >3 items → cards); timeline has 4 dots, the accent only on Now")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nvisual-docs: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
