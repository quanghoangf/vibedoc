// T191: a breakdown plan card shows each task's covered scenarios, on the VibeDoc dev server at :3000.
// /api/chat is stubbed (the "agent" proposes a plan); nothing is accepted, and the chat is deleted at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T191' })

const stamp = Date.now()
const plan = {
  kind: 'breakdown',
  epic: 'R068',
  tasks: [
    { key: 't1', title: `Seed probe one ${stamp}`, size: 'S (~1 hr)', body: '## Goal\nx', covers: ['S1', 'S2'] },
    { key: 't2', title: `Seed probe two ${stamp}`, body: '## Goal\ny' },
  ],
}
const turn = [
  { type: 'assistant', session_id: 's1', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'mcp__vibedoc__vibedoc_propose_plan', input: { plan } }] } },
  { type: 'result', is_error: false, session_id: 's1' },
]

test('T191 Plan card shows covers', async ({ page, step, request }) => {
  await page.route('**/api/chat**', (route) =>
    route.fulfill({ contentType: 'application/x-ndjson', body: turn.map((l) => JSON.stringify(l)).join('\n') + '\n' }))
  try {
    await step('Ask the agent for a breakdown whose first task covers S1 and S2 → the plan card row reads "covers S1, S2" and the other row has no covers', async () => {
      await page.goto('/board')
      await page.getByRole('button', { name: 'Chats (c)' }).click()
      const box = page.getByPlaceholder(/Ask the agent/)
      await box.fill(`seed probe ${stamp}`)
      await box.press('Enter')
      const one = page.getByRole('listitem').filter({ hasText: `Seed probe one ${stamp}` })
      await expect(one.getByText(/covers S1, S2/)).toBeVisible()
      const two = page.getByRole('listitem').filter({ hasText: `Seed probe two ${stamp}` })
      await expect(two).toBeVisible()
      await expect(two.getByText(/covers/)).toHaveCount(0)
    })
  } finally {
    const { chats } = await (await request.get('/api/conversations')).json() as { chats: { id: string; messages?: unknown[] }[] }
    for (const c of chats.filter((c) => JSON.stringify(c.messages ?? []).includes(`seed probe ${stamp}`))) {
      await request.post('/api/conversations', { data: { delete: c.id } })
    }
  }
})
