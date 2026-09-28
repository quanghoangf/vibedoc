// Browser check for the chat QuestionCard (T037).
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/ask-questions.mjs
//
// Stubs /api/chat (see stub-chat.mjs); writes nothing.
import assert from "node:assert/strict"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const questions = [
  {
    question: "Who is this for?",
    header: "Users",
    multiSelect: true,
    options: [
      { label: "Solo devs + Claude Code", description: "One person, one agent" },
      { label: "Small teams sharing a repo" },
      { label: "Enterprises" },
    ],
  },
  {
    question: "How much time?",
    header: "Budget",
    multiSelect: false,
    options: [{ label: "~1 day (2–3 tasks)" }, { label: "~1 week (5–8 tasks) (Recommended)" }],
  },
  {
    question: "What is in scope?",
    header: "Scope",
    multiSelect: false,
    options: [{ label: "Everything" }, { label: "Only the core" }],
  },
]

const browser = await launchChrome()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const calls = await stubChat(page, (call) =>
    call === 0 ? toolTurn("tu0", "vibedoc_ask_questions", { questions }, "A few questions first.") : toolTurn("tu1", "vibedoc_get_status", {}, "Thanks."),
    { root: makeFixture() })
  await page.goto(`${BASE}/board`)
  await page.waitForLoadState("networkidle")
  await page.keyboard.press("c")

  const box = page.getByPlaceholder(/Ask the agent/)
  await box.fill("plan the roadmap")
  await box.press("Enter")

  // 1. Checkboxes for multiSelect, radios otherwise, each with Other
  const card = page.locator("[data-question-card]")
  await card.waitFor()
  const fs = card.locator("fieldset")
  assert.equal(await fs.nth(0).locator('input[type="checkbox"]').count(), 4)
  assert.equal(await fs.nth(1).locator('input[type="radio"]').count(), 3)
  await card.getByText("One person, one agent").waitFor()
  await page.getByPlaceholder("Answer the questions above…").waitFor()
  console.log("ok  card renders checkboxes, radios and Other; placeholder hints at the card")

  const submit = card.getByRole("button", { name: "Submit" })
  await fs.nth(0).getByLabel("Solo devs + Claude Code").check()
  await fs.nth(0).getByLabel("Small teams sharing a repo").check()
  await fs.nth(1).getByLabel("~1 day (2–3 tasks)").check()
  await fs.nth(1).getByLabel("~1 week (5–8 tasks) (Recommended)").check() // radio: replaces the first
  assert.equal(await submit.isDisabled(), true, "Submit stays disabled until every question has an answer")
  await fs.nth(2).getByLabel("Other").check()
  await card.getByLabel("Other answer for Scope").fill("only the billing page")

  // 2. Submit sends exactly one message in the answer format, and the card locks
  await submit.click()
  await card.getByText("✓ Answered").waitFor()
  await page.getByText("Thanks.").waitFor()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].message, [
    "Answers:",
    "- Users: Solo devs + Claude Code, Small teams sharing a repo",
    "- Budget: ~1 week (5–8 tasks) (Recommended)",
    '- Scope: Other: "only the billing page"',
  ].join("\n"))
  assert.equal(await card.locator("input").count(), 0)
  assert.equal(await submit.count(), 0)
  await card.getByText('Other: "only the billing page"').waitFor()
  await page.getByPlaceholder(/Ask the agent/).waitFor()
  console.log("ok  submit sent one message in the answer format; card is read-only")
} finally {
  await browser.close()
}
