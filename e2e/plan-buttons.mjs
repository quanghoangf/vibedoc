// Browser check for the roadmap "Plan with agent" / "Break down with agent" buttons (T044).
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/plan-buttons.mjs
//
// Stubs /api/chat (see stub-chat.mjs); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const turn = (call) => toolTurn(`tu${call}`, "vibedoc_get_planning_guide", {}, `Reply ${call}.`)

const browser = await launchChrome()
try {
  // 1. Empty roadmap → "Plan with agent" opens the chat and sends the message
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    const calls = await stubChat(page, turn, { root: mkdtempSync(path.join(tmpdir(), "vibedoc-e2e-")) })
    await page.goto(`${BASE}/roadmap`)
    await page.getByRole("button", { name: "Plan with agent" }).click()
    await page.getByText("Reply 0.").waitFor()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].message, "Plan a roadmap for this project.")
    assert.equal(await page.getByRole("button", { name: "Close chat" }).isVisible(), true)
    console.log("ok  Plan with agent opens the chat and sends the message")
    await page.close()
  }

  // 2. Epic without tasks → "Break down with agent"; a second ask while busy is refused
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    let release
    const hold = new Promise((r) => { release = r })
    const calls = await stubChat(page, turn, { root: makeFixture() })
    // Hold the first reply open so the chat stays busy
    await page.route("**/api/chat**", async (route) => { await hold; await route.fallback() })
    await page.goto(`${BASE}/roadmap`)
    await page.locator(".react-flow__node", { hasText: "Epic" }).click()
    await page.getByRole("button", { name: "Break down with agent" }).click()
    await page.getByText("Thinking…").waitFor()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "again" } })))
    await page.getByText("Agent is busy").waitFor()
    release()
    await page.getByText("Reply 0.").waitFor()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].message, "Break down epic R002 into tasks.")
    console.log("ok  Break down with agent sends the epic id; busy ask is refused, not queued")

    // Horizon sheet has no such button
    await page.locator(".react-flow__node", { hasText: "Now" }).first().click()
    await page.getByRole("button", { name: "Add feature" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Break down with agent" }).count(), 0)
    console.log("ok  horizon sheet has no Break down button")
  }
} finally {
  await browser.close()
}
