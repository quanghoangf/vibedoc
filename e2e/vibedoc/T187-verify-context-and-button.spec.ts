// T187: the Verify button on a task in review (panel and card), on the VibeDoc dev server at :3000.
// Creates its own probe task (moved to review) and deletes it at the end; /api/chat is stubbed, so no agent runs.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T187' })

test('T187 Verify button', async ({ page, step, request }) => {
  const created = await request.post('/api/tasks/create', { data: { title: `Verify probe ${Date.now()}` } })
  expect(created.ok()).toBe(true)
  const id: string = (await created.json()).task.id
  await page.route('**/api/chat**', (route) => route.fulfill({ contentType: 'application/x-ndjson', body: '' }))
  try {
    expect((await request.post('/api/tasks', { data: { taskId: id, status: 'review' } })).ok()).toBe(true)

    await step('Open a task in review → the panel shows a Verify button next to Chat about task', async () => {
      await page.goto(`/board?task=${id}`)
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Verify', exact: true })).toBeVisible()
      await expect(page.getByRole('dialog').getByRole('button', { name: /Chat about task|Open chat/ }).last()).toBeVisible()
    })

    await step('Click Verify → a new agent chat starts with "Verify task <id>: call vibedoc_verify_context, then vibedoc_report_findings."', async () => {
      const sent = page.waitForRequest('**/api/chat**')
      await page.getByRole('dialog').getByRole('button', { name: 'Verify', exact: true }).click()
      const req = await sent
      expect((req.postDataJSON() as { message: string }).message).toContain(`Verify task ${id}: call vibedoc_verify_context, then vibedoc_report_findings.`)
      await expect(page.getByText(`Verify task ${id}`).first()).toBeAttached()
    })

    await step('Close the panel and hover the task\'s card in Review → a Verify button shows on the card', async () => {
      await page.keyboard.press('Escape')
      const card = page.getByRole('button', { name: new RegExp(`^${id} `) })
      await card.hover()
      await expect(card.getByRole('button', { name: `Verify ${id}` })).toBeVisible()
    })
  } finally {
    // the probe chat this test started (saved at turn start)
    const { chats } = await (await request.get('/api/conversations')).json() as { chats: { id: string; messages?: { text?: string }[] }[] }
    for (const c of chats.filter((c) => JSON.stringify(c.messages ?? []).includes(`Verify task ${id}:`))) {
      await request.post('/api/conversations', { data: { delete: c.id } })
    }
    await request.post('/api/tasks/delete', { data: { id } })
  }
})
