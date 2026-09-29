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

  // 2. Epic without tasks → "Break down with agent"; a second ask while busy opens a second tab and runs in parallel
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    let release
    const hold = new Promise((r) => { release = r })
    let inFlight = 0
    // Chat A answers "Reply A." as session sA; chat B ("again") answers "Reply B." as sB
    const turnIn = (c) => turn(c).map((l) => ({ ...l, session_id: `s${c}` }))
    const calls = await stubChat(page, (call, body) => turnIn(body.message === "again" ? "B" : "A"), { root: makeFixture() })
    // Hold every reply open so both chats stay busy
    await page.route("**/api/chat**", async (route) => { inFlight++; await hold; await route.fallback() })
    await page.goto(`${BASE}/roadmap`)
    await page.locator(".react-flow__node-feature", { hasText: "Epic" }).click()
    await page.getByRole("button", { name: "Break down with agent" }).click()
    await page.getByText("Thinking…").waitFor()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "again" } })))
    await page.getByRole("tab", { name: "again" }).waitFor()
    await page.waitForFunction(() => document.querySelectorAll('[role=tabpanel]:not([hidden])').length === 1)
    for (let i = 0; i < 50 && inFlight < 2; i++) await page.waitForTimeout(100)
    assert.equal(inFlight, 2, "both /api/chat requests are in flight at once")
    assert.equal(await page.getByRole("tab").count(), 2)
    assert.equal(await page.getByText("Agent is busy").count(), 0)
    release()
    // The active tab is the new one; each reply lands in its own chat
    await page.getByText("Reply B.").waitFor()
    assert.equal(await page.getByText("Reply A.").isVisible(), false)
    await page.getByRole("tab", { name: "Break down R002" }).click()
    await page.getByText("Reply A.").waitFor()
    assert.equal(await page.getByText("Reply B.").isVisible(), false)
    assert.equal(calls.length, 2)
    const first = calls.find((c) => c.message === "Break down epic R002 into tasks.")
    const second = calls.find((c) => c.message === "again")
    assert.ok(first && second)
    assert.equal(second.sessionId ?? null, null)
    console.log("ok  busy ask opens a second tab; both stream at once into their own chats")

    // A follow-up in tab A resumes A's session
    await page.getByPlaceholder("Ask the agent… (Enter to send)").fill("more")
    await page.keyboard.press("Enter")
    await page.getByText("Reply A.").nth(1).waitFor()
    assert.equal(calls.length, 3)
    assert.equal(calls[2].sessionId, "sA")
    console.log("ok  follow-up in tab A resumes A's session")

    // An ask while the active chat is idle goes into that chat, no new tab
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "idle ask" } })))
    await page.getByText("Reply A.").nth(2).waitFor()
    assert.equal(await page.getByRole("tab").count(), 2)
    assert.equal(calls[3].sessionId, "sA")
    console.log("ok  ask while the active chat is idle reuses it")

    // Horizon sheet has no such button
    await page.locator(".react-flow__node", { hasText: "Now" }).first().click()
    await page.getByRole("button", { name: "Add epic" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Break down with agent" }).count(), 0)
    console.log("ok  horizon sheet has no Break down button")
  }
} finally {
  await browser.close()
}
