// Browser check for R096 (Visual docs) on fixture docs in the /docs preview:
//   T513. a flowchart, a sequence and a state diagram render in VibeDoc's tokens (node stroke = the rule-line token,
//         the `accent` class = the accent) in light and in dark, and a theme switch re-colours them without a reload;
//         a broken diagram shows its error and source inline while the others still render; typing in the Split
//         editor re-renders the preview's diagram
//   S2 (T514). hover/Tab shows a diagram's Fullscreen · Copy source toolbar; fullscreen zooms with + / wheel, drag pans,
//       Fit resets, Esc closes and focus returns to the button; Copy source puts the ```mermaid fence on the clipboard
//   S5 (T518). the editor's Insert visual menu inserts each of the 4 diagram templates and 4 visual blocks; the Split
//       preview renders all 8 without an error; the menu works by keyboard and focus returns to the editor
//   S4 (T517). Copy on a visual block puts text/html (inline styles, no classes) + text/plain (the markdown) on the
//       clipboard; Copy image on a diagram puts image/png + the fenced source; without ClipboardItem the markdown is copied
//   S3. a list under <!-- vibedoc:steps --> renders N cards with N−1 arrows, one under <!-- vibedoc:cards --> a grid
//       (one column at 390px, no page overflow); /md/<path> and GitHub (gh api /markdown, skipped when gh isn't
//       logged in) still show the plain list
//   S3 (T516). <!-- vibedoc:compare --> renders 2 columns side by side at 1400px and stacked at 390px; a 4-item compare
//       falls back to cards; <!-- vibedoc:timeline --> renders a dot per item with the accent only on "Now"
//   Done-when (T519). one doc with a diagram and all four visual blocks renders in light and dark at 390px without page
//       overflow, and vibedoc_read_doc returns it as the plain lists and the mermaid fence
//   Wide diagrams. a flowchart wider than the prose column breaks out of it up to the pane (data-wide); when it still
//       can't fit it scrolls with a right-edge fade and a Fit chip: Fit scales it to the width, "Scroll →" goes back
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

const ALL = [
  "# All visuals", "",
  "```mermaid", "flowchart LR", "  A[Write] --> B[Render]", "  class B accent", "```", "",
  "<!-- vibedoc:steps -->", "1. **One** — first", "2. **Two** — second", "",
  "<!-- vibedoc:cards -->", "- **A** — a", "- **B** — b", "",
  "<!-- vibedoc:compare -->", "- **Left** — l", "  - point", "- **Right** — r", "  - point", "",
  "<!-- vibedoc:timeline -->", "1. **Then** — before", "2. **Now** — today", "",
].join("\n")
write("docs/all.md", ALL)
write("docs/blank.md", "# Blank\n")
write("docs/live.md", "# Live\n\n```mermaid\nflowchart LR\n  A --> B\n```\n")
// 16 boxes in a row with long labels: far wider than any pane at 1280px, even at the 75% floor
write("docs/wide.md", ["# Wide", "", "Some prose above.", "", "```mermaid", "flowchart LR",
  ...Array.from({ length: 15 }, (_, i) => `  N${i}[Step number ${i} of the long chain] --> N${i + 1}[Step number ${i + 1} of the long chain]`), "```", ""].join("\n"))

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
  assert.equal(await error.locator(".mermaid-error-title").textContent(), "This diagram couldn't be drawn")
  assert.equal(await error.locator(".mermaid-error-message").textContent(), "Line 2: expected a box name after the arrow, found another arrow.", "the error says where and what, in words")
  assert.deepEqual(await error.locator(".mermaid-error-row").allTextContents(), BROKEN.split("\n"), "the source is shown, a row per line")
  assert.deepEqual(await error.locator(".mermaid-error-row").evaluateAll((rows) => rows.map((r) => [r.dataset.line, "bad" in r.dataset])), [["1", false], ["2", true]], "numbered, the failing line marked")
  const details = error.locator("details.mermaid-error-details")
  assert.equal(await details.evaluate((d) => d.open), false, "Mermaid's own message is folded")
  assert.match(await details.locator("pre").textContent(), /^Parse error on line 2:[\s\S]*got 'LINK'$/, "and kept whole under Details")
  assert.equal(await page.locator("body > [id^=dmermaid], body > svg[id^=mermaid]").count(), 0, "no stray error graphic left on the page")
  console.log("ok  broken diagram: a titled box says the line and the problem in words, numbered source with the bad line marked, raw message under Details; the other three render")

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

    // S4: Copy image → a PNG plus the source as text
    await first.hover()
    await first.getByRole("button", { name: "Copy diagram as image" }).click()
    await p2.getByText(/Copied the diagram as an image/).waitFor()
    const img = await p2.evaluate(async () => {
      const [item] = await navigator.clipboard.read()
      const png = await item.getType("image/png")
      const bmp = await createImageBitmap(png)
      return { types: item.types, size: png.size, w: bmp.width, text: await (await item.getType("text/plain")).text() }
    })
    assert.ok(img.types.includes("image/png") && img.size > 1000, `a PNG (${img.types}, ${img.size} bytes)`)
    assert.ok(img.w > 400, `drawn at 2× (${img.w}px wide)`)
    assert.match(img.text, /^```mermaid\nflowchart LR\n/)
    console.log("ok  S4: Copy image puts a PNG and the mermaid source on the clipboard")

    // S4: Copy on a visual block → formatted HTML + the markdown
    await p2.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blocks.md")}`)
    const stepsBlock = p2.locator('.doc-preview [data-visual="steps"]')
    await stepsBlock.hover()
    await stepsBlock.getByRole("button", { name: "Copy (keeps the look when pasted)" }).click()
    await p2.getByText(/Copied: paste into Docs/).waitFor()
    const rich = await p2.evaluate(async () => {
      const [item] = await navigator.clipboard.read()
      return { types: item.types, html: await (await item.getType("text/html")).text(), text: await (await item.getType("text/plain")).text() }
    })
    assert.ok(rich.types.includes("text/html") && rich.types.includes("text/plain"), String(rich.types))
    assert.match(rich.html, /<table style="/)
    assert.match(rich.html, /Focus/)
    assert.match(rich.html, /Example: finish the transaction flow/)
    assert.doesNotMatch(rich.html, /class="md-visual/, "inline styles, not the page's classes")
    assert.equal(rich.text, "<!-- vibedoc:steps -->\n1. **Focus** — One main goal at a time.\n   Example: finish the transaction flow.\n2. **Queue** — New asks go to a queue.\n3. **Ship** — Small and often.")
    console.log("ok  S4: Copy on a steps block puts formatted HTML and its markdown on the clipboard")

    // no ClipboardItem: the markdown, and the toast says so
    await p2.evaluate(() => { delete window.ClipboardItem })
    await stepsBlock.hover()
    await stepsBlock.getByRole("button", { name: "Copy (keeps the look when pasted)" }).click()
    await p2.getByText(/Copied the markdown/).waitFor()
    assert.match(await p2.evaluate(() => navigator.clipboard.readText()), /^<!-- vibedoc:steps -->/)
    console.log("ok  S4: without ClipboardItem the markdown is copied and the toast says so")
    await p2.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/diagrams.md")}`)
    await first.locator(":scope > svg").waitFor()

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

  // S5 (T518): Insert visual — every entry renders; keyboard works; focus returns to the editor
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blank.md")}`)
  await page.getByRole("tab", { name: "Split" }).click()
  const cm = page.locator(".cm-content")
  await cm.waitFor()
  const insertBtn = page.getByRole("button", { name: "Insert diagram or visual block" })
  const toEnd = async () => { await cm.click(); await page.keyboard.press("ControlOrMeta+End") }
  // first one by keyboard: focus the button, Enter opens, ArrowDown to Sequence, Enter inserts
  await toEnd()
  await insertBtn.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("menuitem", { name: "Flowchart" }).waitFor()
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem" ? document.activeElement.textContent : null)
  // Radix wires its roving focus a beat after the menu opens; an ArrowDown sent at once is dropped
  await page.waitForTimeout(150)
  for (let i = 0; i < 4 && (await focused()) !== "Sequence diagram"; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(50) }
  assert.equal(await focused(), "Sequence diagram", "arrow keys move through the menu")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.activeElement?.closest(".cm-editor") !== null)
  const entries = ["Flowchart", "State diagram", "Data model (ER)", "Steps", "Cards", "Compare", "Timeline"]
  for (const name of entries) {
    await toEnd()
    await insertBtn.click()
    await page.getByRole("menuitem", { name, exact: true }).click()
  }
  await preview.locator('[data-visual="timeline"]').waitFor()
  await page.waitForFunction(() => document.querySelectorAll(".doc-preview .mermaid > svg").length === 4, null, { timeout: 15000 })
  assert.equal(await preview.locator(".mermaid-error").count(), 0, "every template parses")
  for (const kind of ["steps", "cards", "compare", "timeline"]) assert.equal(await preview.locator(`[data-visual="${kind}"]`).count(), 1, kind)
  assert.match(await cm.textContent(), /sequenceDiagram/, "the keyboard pick was Sequence")
  console.log("ok  S5: Insert visual inserts 4 diagrams and 4 visual blocks that all render; keyboard works, focus returns to the editor")

  // S3 visual blocks (T515)
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/blocks.md")}`)
  await page.setViewportSize({ width: 1280, height: 900 })

  // S3 steps: three steps in an <ol>, each with its drawn number badge, title / body / detail split
  const steps = preview.locator('[data-visual="steps"]')
  await steps.waitFor()
  assert.equal(await steps.getByRole("list").count(), 1, "list semantics kept")
  assert.equal(await steps.locator("ol > li").count(), 3)
  assert.equal(await steps.locator(".md-visual-card").count(), 3)
  assert.deepEqual(await steps.locator(".md-visual-num").allTextContents(), ["1", "2", "3"], "a number per step")
  assert.equal(await steps.locator(".md-visual-title").first().textContent(), "Focus")
  assert.equal(await steps.locator(".md-visual-body").first().textContent(), "One main goal at a time.")
  assert.equal((await steps.locator(".md-visual-detail").first().textContent()).trim(), "Example: finish the transaction flow.")
  const [numLeft, cardLeft, cardTop, nextTop] = await steps.evaluate((el) => {
    const [num, card, next] = [el.querySelector(".md-visual-num"), el.querySelector(".md-visual-card"), el.querySelectorAll(".md-visual-card")[1]].map((e) => e.getBoundingClientRect())
    return [num.left, card.left, card.top, next.top]
  })
  assert.ok(numLeft < cardLeft && cardTop < nextTop, "steps stack, each number left of its text")
  // the badge is a strong-rule ring, in light and in dark
  const look = await steps.evaluate((root) => {
    const read = () => ({
      border: getComputedStyle(root.querySelector(".md-visual-num")).borderTopColor,
      rule: getComputedStyle(document.documentElement).getPropertyValue("--rgb-border2").trim(),
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
    assert.equal(look[mode].border, rgb(look[mode].rule), `${mode}: number ring is the strong rule line`)
  }
  assert.notEqual(look.dark.border, look.light.border, "steps follow the theme")
  console.log("ok  S3: a steps block renders 3 numbered steps with strong-rule rings in light and dark")

  // S3 cards: a grid of four cards, the icon kept; the unmarked list and the task list stay plain lists
  const cards = preview.locator('[data-visual="cards"]')
  assert.equal(await cards.locator(".md-visual-card").count(), 4)
  assert.equal(await cards.locator(".md-visual-num").count(), 0)
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

  // Wide diagrams: break out of the prose column, then fade + Fit / Scroll → chip
  {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/wide.md")}`)
    const frame = preview.locator("[data-diagram-frame]")
    await frame.locator(".mermaid > svg").waitFor()
    await page.waitForFunction(() => document.querySelector("[data-diagram-frame]")?.hasAttribute("data-overflow"))
    const widths = await page.evaluate(() => ({
      frame: document.querySelector("[data-diagram-frame]").getBoundingClientRect().width,
      prose: document.querySelector(".doc-preview > p").getBoundingClientRect().width,
      pane: document.querySelector(".doc-preview").getBoundingClientRect().width,
    }))
    assert.ok(await frame.evaluate((el) => el.hasAttribute("data-wide")), "the frame is marked wide")
    assert.ok(widths.frame >= widths.pane - 2 && widths.frame >= widths.prose, `the frame spans the pane, not the prose column (${JSON.stringify(widths)})`)
    // the fade eases its opacity over 120ms: wait for it to settle, up to 2s
    const fade = async (want) => {
      const el = frame.locator(".diagram-fade")
      let v
      for (let i = 0; i < 20 && (v = await el.evaluate((n) => getComputedStyle(n).opacity)) !== want; i++) await page.waitForTimeout(100)
      return v
    }
    assert.equal(await fade("1"), "1", "a right-edge fade says there is more")
    const chip = frame.getByRole("button", { name: "Fit the diagram to the width" })
    assert.equal(await chip.textContent(), "Fit")
    await chip.focus()
    await page.keyboard.press("Enter")
    await frame.getByRole("button", { name: "Show the diagram at full size and scroll sideways" }).waitFor()
    assert.equal(await frame.locator(".diagram-fit").textContent(), "Scroll →")
    const fits = await frame.evaluate((el) => { const n = el.querySelector(".mermaid"); return n.scrollWidth <= n.clientWidth + 1 })
    assert.ok(fits, "Fit scales the diagram to the width")
    assert.equal(await fade("0"), "0", "no fade while it fits")
    await frame.locator(".diagram-fit").click()
    assert.equal(await frame.locator(".diagram-fit").textContent(), "Fit")
    assert.ok(await frame.evaluate((el) => { const n = el.querySelector(".mermaid"); return n.scrollWidth > n.clientWidth + 1 }), "Scroll → goes back to the scrolling diagram")
    console.log("ok  a wide diagram breaks out of the prose column, fades at the edge, and Fit / Scroll → toggle")
  }

  // Done-when: everything on one page, light and dark, phone width; agents read the plain text
  await page.setViewportSize({ width: 390, height: 844 })
  for (const dark of [false, true]) {
    await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/all.md")}`)
    await page.evaluate((d) => document.documentElement.classList.toggle("dark", d), dark)
    await preview.locator(".mermaid > svg").waitFor()
    for (const kind of ["steps", "cards", "compare", "timeline"]) assert.equal(await preview.locator(`[data-visual="${kind}"]`).count(), 1, `${kind} (${dark ? "dark" : "light"})`)
    assert.equal(await preview.locator(".mermaid-error").count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no page overflow at 390px (${dark ? "dark" : "light"})`)
  }
  const mcp = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_doc", arguments: { query: "docs/all.md" } } }) })
  const agentText = (await mcp.json()).result.content[0].text
  assert.ok(agentText.includes(ALL.trim()), "vibedoc_read_doc returns the file's markdown: the fence and the marked plain lists")
  console.log("ok  Done-when: a diagram and all four blocks render light and dark at 390px; vibedoc_read_doc returns the plain markdown")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nvisual-docs: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
