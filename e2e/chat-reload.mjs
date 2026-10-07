// Browser check: an agent chat turn survives a page reload (the turn runs on the server, src/lib/chat-turns.ts).
//   1. Send a message → reload mid-turn → the chat shows the agent working again, then the full reply; never
//      "Interrupted"; the saved chat file has the reply after the turn ends.
//   2. Send again → Stop → the server's claude child is gone (a new message can be sent right away).
//   3. Reload after a turn ended (and before the browser saved it): the reply is replayed from the server.
// Fails on any browser console error.
//
// The server must run with e2e/fixtures/claude-stub first on PATH (its `-p` mode streams a ~4s turn), e.g.
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH pnpm exec next start -p 3196   (after pnpm build)
//   BASE=http://localhost:3196 PW_DIR=<dir with node_modules/playwright> node e2e/chat-reload.mjs
//
// Only /api/projects is stubbed (the chat goes through the real /api/chat); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3196"
const fx = makeFixture()
const savedChats = () => {
  try {
    return readdirSync(path.join(fx, ".vibedoc/chats")).map((f) => JSON.parse(readFileSync(path.join(fx, ".vibedoc/chats", f), "utf8")))
  } catch { return [] }
}
async function until(fn, what, ms = 15000) {
  for (let t = 0; t < ms; t += 100) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)) }
  assert.fail(`timed out: ${what}`)
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("**/api/projects", (route) => route.fulfill({ json: [{ id: "fixture", name: "fixture", root: fx, hasVibedoc: true }] }))

  const box = page.getByPlaceholder("Ask the agent… (Enter to send)")
  const send = async (text) => { await box.fill(text); await box.press("Enter") }

  // 1. reload mid-turn → picks the turn back up
  await page.goto(`${BASE}/chat`)
  await page.getByRole("button", { name: /New chat/ }).first().click().catch(() => {})
  await box.waitFor()
  await send("Verify task T185 please")
  await page.getByText("Checked the task").first().waitFor()
  await page.reload()
  await page.getByText(/Verify task T185 please/).first().waitFor()
  await page.getByText(/found nothing wrong: "Verify task T185 please"/).first().waitFor({ timeout: 15000 })
  assert.equal(await page.getByText(/Interrupted/).count(), 0, "no Interrupted note")
  await until(() => savedChats().some((c) => c.messages.at(-1)?.text?.includes("found nothing wrong")), "reply saved to .vibedoc/chats")
  console.log("ok  reload mid-turn → the reply streams in and is saved, no Interrupted")

  // 2. Stop kills the server turn: a new message goes straight through (no 409 'already running')
  await send("Second question")
  await page.getByText("Checked the task").nth(1).waitFor()
  await page.getByRole("button", { name: "Stop" }).first().click()
  await page.getByPlaceholder("Ask the agent… (Enter to send)").waitFor()
  await send("Third question")
  await page.getByText(/found nothing wrong: "Third question"/).first().waitFor({ timeout: 15000 })
  console.log("ok  Stop ends the server turn; the next message runs")

  // 3. reload right as a turn ends: replayed from the server's buffer
  await send("Fourth question")
  await page.getByText("Checked the task").nth(3).waitFor()
  await page.reload()
  await page.getByText(/found nothing wrong: "Fourth question"/).first().waitFor({ timeout: 15000 })
  assert.equal(await page.getByText(/Interrupted/).count(), 0, "no Interrupted note after the replay")
  console.log("ok  a reload near the end replays the finished turn")

  assert.deepEqual(errors, [], "no console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
}
