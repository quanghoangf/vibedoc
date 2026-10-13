// T526: the agent's toolkit card in chat, on the VibeDoc dev server at :3000. Only the agent's turn is stubbed
// (a vibedoc_propose_toolkit tool_use); the card, /api/toolkit and the dialog are real. Read-only: the server runs the
// real `claude`, so the spec never confirms an install. Installing from the card is checked with the fake CLI in
// e2e/toolkit.mjs.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T526' })

const turn = [
  { type: 'assistant', session_id: 's1', message: { content: [{ type: 'tool_use', id: 'tk1', name: 'mcp__vibedoc__vibedoc_propose_toolkit', input: { preselect: ['typescript-lsp'], note: 'Probe note from the T526 spec.' } }] } },
  { type: 'result', is_error: false, session_id: 's1' },
]

test('T526 Toolkit card in chat', async ({ page, step, request }) => {
  // the chat this test opens is saved to .vibedoc/chats: remember what was there and delete the rest at the end
  const chatIds = async (): Promise<string[]> => ((await (await request.get('/api/conversations')).json()) as { chats: { id: string }[] }).chats.map((c) => c.id)
  const before = new Set(await chatIds())
  await page.route('**/api/chat**', (route) => route.fulfill({ contentType: 'application/x-ndjson', body: turn.map((l) => JSON.stringify(l)).join('\n') + '\n' }))
  const card = page.locator('[data-toolkit-card]')

  await step('Ask the agent to set up the toolkit → a "Pick your toolkit" card shows its note and the ranked plugins', async () => {
    await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: 'http://localhost:3000' }])
    await page.goto('/start')
    await page.getByRole('button', { name: /Generate roadmap from your docs|Plan the first epics with the agent/ }).click()
    await expect(card.getByText('Pick your toolkit')).toBeVisible()
    await expect(card.getByText('Probe note from the T526 spec.')).toBeVisible()
    await expect(card.getByText(/Frontend design/)).toBeVisible()
  })

  await step('The plugin the agent preselected (TypeScript LSP) is ticked', async () => {
    const lsp = card.getByRole('checkbox', { name: /TypeScript LSP/ })
    await expect(lsp).toBeChecked()
  })

  await step('Click Install selected, then press Escape → only the confirm dialog closes; the chat and its card stay', async () => {
    await card.getByRole('button', { name: /^Install \d+ plugins?$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Install these plugins in Claude Code?' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(card.getByText('Pick your toolkit')).toBeVisible()
  })

  for (const id of await chatIds()) {
    if (!before.has(id)) await request.post('/api/conversations', { data: { delete: id } })
  }
})
