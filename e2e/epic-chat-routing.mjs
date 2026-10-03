// Browser check: each epic's "Break down with agent" gets its own chat. The bug: a chat waiting on your answers is
// not busy, so the second epic's ask went into the first epic's chat (same Claude session, wrong attach).
//   1. Break down R002 from its sheet → a chat about R002 asks questions (needs an answer).
//   2. Break down R003 from its sheet → a second chat, attached to R003, with a fresh session; R002's chat untouched.
//   3. Ask to break down R002 again while it waits → its chat opens; nothing is sent.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/epic-chat-routing.mjs
//
// Stubs /api/chat (see stub-chat.mjs); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"

const fx = makeFixture()
writeFileSync(path.join(fx, "plans/roadmap/R003-second.md"), "# R003: Second\n**Parent:** R001\n**Status:** planned\n**Order:** 20\n**Tasks:** —\n")

const questions = [{ question: "Which parts are in scope?", header: "Scope", multiSelect: false, options: [{ label: "All" }, { label: "Core only" }] }]

const browser = await launchChrome()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const calls = await stubChat(page, (_call, body) => {
    const epic = body.message.match(/R\d+/)?.[0]
    return toolTurn(`tu${epic}`, "vibedoc_ask_questions", { questions }, `Questions for ${epic}.`).map((l) => ({ ...l, session_id: `s${epic}` }))
  }, { root: fx })
  const SIDEBAR = '[aria-label="Chats"]'
  const chatRows = () => page.locator(`${SIDEBAR} li button[title^="Break down"]`).count()

  // In-app, as a user does: the first sheet from a deep link, later ones by clicking the map (no reload, so the chat
  // store keeps its "current chat" — the reload in a goto would hide the bug)
  async function breakDown(epic) {
    if (page.url().includes("/roadmap")) await page.locator(`.react-flow__node[data-id="${epic}"]`).click()
    else await page.goto(`${BASE}/roadmap?item=${epic}`)
    await page.getByRole("button", { name: "Break down with agent" }).click()
  }

  // 1. R002 asks questions and waits on you
  await breakDown("R002")
  await page.getByText("Questions for R002.").waitFor()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].sessionId, null)
  await page.keyboard.press("Escape")

  // 2. R003 gets its own chat and session, not R002's waiting one
  await breakDown("R003")
  await page.getByText("Questions for R003.").waitFor()
  assert.equal(calls.length, 2)
  assert.match(calls[1].message, /Break down epic R003/)
  assert.equal(calls[1].sessionId, null, "R003 starts a fresh Claude session, not R002's")
  await page.waitForFunction((s) => document.querySelectorAll(`${s} li button[title^="Break down"]`).length === 2, SIDEBAR)
  assert.equal(await page.getByRole("dialog").getByText("Questions for R002.").count(), 0, "the open chat is R003's, without R002's turn")
  console.log("ok  a second epic's breakdown starts its own chat and session while the first waits on answers")
  await page.keyboard.press("Escape")

  // 3. R002 asked again (the sheet hides its button while the chat waits; the multi-epic dialog, the editor and the
  //    palette reach askAgent the same way): its waiting chat opens, no second ask is sent
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("vibedoc:ask-agent", { detail: { message: "Break down epic R002 into tasks." } })))
  await page.getByRole("dialog").getByText("Questions for R002.").waitFor()
  await page.waitForTimeout(300)
  assert.equal(calls.length, 2, "no new request while R002's chat waits on you")
  assert.equal(await chatRows(), 2)
  console.log("ok  breaking down an epic whose chat is waiting opens that chat and sends nothing")
} finally {
  await browser.close()
}
