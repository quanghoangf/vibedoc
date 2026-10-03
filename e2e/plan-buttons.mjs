// Browser check for the roadmap "Plan with agent" / "Break down with agent" buttons (T044).
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/plan-buttons.mjs
//
// Stubs /api/chat (see stub-chat.mjs); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
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
    assert.equal(await page.getByRole("dialog", { name: "Plan a roadmap for this project." }).isVisible(), true)
    console.log("ok  Plan with agent opens the chat modal and sends the message")
    await page.close()
  }

  // 2. Epic without tasks → "Break down with agent"; a second ask while busy opens a second chat that runs in parallel
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
    // The sidebar lists both chats; the modal switched to the new one.
    // CSS locators: while the modal is open, the page behind it is aria-hidden
    const agents = page.locator('[aria-label="Chats"]')
    const chatA = agents.locator("button", { hasText: "Break down R002" })
    await agents.locator("button", { hasText: "again" }).waitFor()
    await page.getByRole("dialog", { name: "again" }).waitFor()
    for (let i = 0; i < 50 && inFlight < 2; i++) await page.waitForTimeout(100)
    assert.equal(inFlight, 2, "both /api/chat requests are in flight at once")
    assert.equal(await page.getByText("Agent is busy").count(), 0)
    release()
    // Each reply lands in its own chat
    await page.getByText("Reply B.").waitFor()
    assert.equal(await page.getByText("Reply A.").isVisible(), false)
    await page.keyboard.press("Escape")
    await chatA.click()
    await page.getByRole("dialog", { name: "Break down R002" }).waitFor()
    await page.getByText("Reply A.").waitFor()
    assert.equal(await page.getByText("Reply B.").isVisible(), false)
    assert.equal(calls.length, 2)
    const first = calls.find((c) => c.message === "Break down epic R002 into tasks.")
    const second = calls.find((c) => c.message === "again")
    assert.ok(first && second)
    assert.equal(second.sessionId ?? null, null)
    console.log("ok  busy ask opens a second chat; both stream at once into their own chats")

    // A follow-up in chat A resumes A's session
    await page.getByPlaceholder("Ask the agent… (Enter to send)").fill("more")
    await page.keyboard.press("Enter")
    await page.getByText("Reply A.").nth(1).waitFor()
    assert.equal(calls.length, 3)
    assert.equal(calls[2].sessionId, "sA")
    console.log("ok  follow-up in chat A resumes A's session")

    // An untargeted ask never lands in an epic's chat, even an idle one: it starts a fresh, unattached chat …
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "idle ask" } })))
    await page.getByRole("dialog", { name: "idle ask" }).waitFor()
    for (let i = 0; i < 50 && calls.length < 4; i++) await page.waitForTimeout(100)
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chats"] [title="Running"]'))
    assert.deepEqual(await agents.locator("li button[title]").evaluateAll((bs) => bs.map((b) => b.title).sort()), ["Break down R002", "again", "idle ask"])
    assert.equal(calls[3].message, "idle ask")
    assert.equal(calls[3].sessionId ?? null, null, "a fresh session, not R002's")
    // … and the next untargeted ask reuses that idle, unattached chat
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "idle ask 2" } })))
    for (let i = 0; i < 50 && calls.length < 5; i++) await page.waitForTimeout(100)
    assert.equal(calls[4].message, "idle ask 2")
    assert.equal(calls[4].sessionId, "sA", "resumes the idle ask chat's session")
    assert.equal(await agents.locator("li button[title]").count(), 3)
    console.log("ok  an untargeted ask skips the epic's chat; an idle unattached chat is reused")

    // The epic now has a chat: its sheet offers "Open chat" instead of another breakdown
    await page.keyboard.press("Escape")
    await page.locator(".react-flow__node-feature", { hasText: "Epic" }).click()
    await page.getByRole("button", { name: "Open chat" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Break down with agent" }).count(), 0)
    await page.getByRole("button", { name: "Open chat" }).click()
    await page.getByRole("dialog", { name: "Break down R002" }).waitFor()
    await page.keyboard.press("Escape")
    console.log("ok  epic sheet: Open chat resumes the epic's chat")

    // Horizon sheet has no such button
    await page.locator(".react-flow__node", { hasText: "Now" }).first().click()
    await page.getByRole("button", { name: "Add epic" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Break down with agent" }).count(), 0)
    console.log("ok  horizon sheet has no Break down button")
  }

  // 3. Board task → "Chat about task": an attached chat whose first turn names the task; reopening resumes it
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    const fx = makeFixture()
    writeFileSync(path.join(fx, "plans/tasks/T001-alpha.md"), "# T001: Alpha\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n\n## Goal\nA\n")
    const calls = await stubChat(page, turn, { root: fx })
    await page.goto(`${BASE}/board?task=T001`)
    await page.getByRole("button", { name: "Chat about task" }).click()
    const modal = page.getByRole("dialog", { name: "Task T001" })
    await modal.getByText("Ask about T001").waitFor()
    await modal.getByRole("button", { name: "What blocks this task?" }).click()
    await page.getByText("Reply 0.").waitFor()
    assert.equal(calls[0].message, "[This chat is about task T001. Read it with vibedoc_get_task before answering.]\n\nWhat blocks this task?")
    await page.keyboard.press("Escape")
    await page.goto(`${BASE}/board?task=T001`)
    await page.getByRole("button", { name: "Open chat" }).click()
    await page.getByText("Reply 0.").waitFor()
    assert.equal(await page.locator('[aria-label="Chats"] li button[title]').count(), 1, "no second chat for the same task")
    console.log("ok  board task chat: first turn names the task; reopening resumes the same chat")
  }
} finally {
  await browser.close()
}
