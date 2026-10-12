// Browser check for R096 (Visual docs) on a fixture doc in the /docs preview:
//   T513. a flowchart, a sequence and a state diagram render in VibeDoc's tokens (node stroke = the rule-line token,
//         the `accent` class = the accent) in light and in dark, and a theme switch re-colours them without a reload;
//         a broken diagram shows its error and source inline while the others still render; typing in the Split
//         editor re-renders the preview's diagram
// Fails on any browser console error. The fixture is a fresh mktemp project.
//
//   PORT=3189 pnpm dev   # then:
//   BASE=http://localhost:3189 PW_DIR=<dir with node_modules/playwright> node e2e/visual-docs.mjs
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
  await doc.locator(".mermaid svg").nth(2).waitFor()

  // the broken one: error message + its source in place; the three valid ones are svgs
  const error = doc.locator(".mermaid-error")
  await error.waitFor()
  assert.equal(await error.getAttribute("role"), "note")
  assert.equal(await doc.locator(".mermaid svg").count(), 3, "the valid diagrams still render")
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
      svgBg: getComputedStyle(root.querySelector(".mermaid svg")).backgroundColor,
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
  assert.equal(await doc.locator(".mermaid svg").count(), 3)
  assert.equal(await doc.locator(".mermaid-error").count(), 1, "the broken one stays an error after the switch")
  console.log("ok  T513: flowchart, sequence and state diagrams follow the tokens in light and dark; a switch re-colours them")

  // live editor preview: typing a new node re-renders the diagram after the debounce, themed, and never as an error
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/live.md")}`)
  await page.getByRole("tab", { name: "Split" }).click()
  const preview = page.locator(".doc-preview")
  await preview.locator(".mermaid svg").waitFor()
  await page.locator(".cm-content").getByText("A --> B").click()
  await page.keyboard.press("End")
  await page.keyboard.type(" --> Cnew", { delay: 30 })
  await preview.locator(".mermaid svg .node").filter({ hasText: "Cnew" }).waitFor()
  assert.equal(await preview.locator(".mermaid-error").count(), 0, "a finished edit leaves no error box")
  assert.equal(await preview.locator(".mermaid svg").count(), 1)
  console.log("ok  live preview: typing re-renders the diagram after the debounce")

  assert.deepEqual(errors, [], "no console errors")
  console.log("\nvisual-docs: all checks passed")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
