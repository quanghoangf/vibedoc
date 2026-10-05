// T192: scenario coverage warnings on a plan card and in the roadmap's "need attention", on the dev server at :3000.
// Creates its own probe epic (under R002, scenarios S1–S2) and task, and deletes them and the stub chat at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T192' })

test('T192 Scenario coverage check', async ({ page, step, request }) => {
  const stamp = Date.now()
  const created = await request.post('/api/tasks/create', { data: { title: `Coverage probe ${stamp}` } })
  expect(created.ok()).toBe(true)
  const task: string = (await created.json()).task.id
  const epicRes = await request.post('/api/roadmap/create', { data: {
    title: `Coverage probe epic ${stamp}`, parent: 'R002', tasks: [task],
    body: '## Scenarios\n### S1: First\n- WHEN a\n- THEN b\n\n### S2: Second\n- WHEN c\n- THEN d\n',
  } })
  expect(epicRes.ok()).toBe(true)
  const epic: string = (await epicRes.json()).item.id
  const plan = { kind: 'breakdown', epic, tasks: [{ key: 't1', title: `Covers one ${stamp}`, body: '## Goal\nx', covers: ['S1'] }] }
  await page.route('**/api/chat**', (route) => route.fulfill({
    contentType: 'application/x-ndjson',
    body: [
      { type: 'assistant', session_id: 's1', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'mcp__vibedoc__vibedoc_propose_plan', input: { plan } }] } },
      { type: 'result', is_error: false, session_id: 's1' },
    ].map((l) => JSON.stringify(l)).join('\n') + '\n',
  }))
  try {
    await step('Open /roadmap with an epic whose task covers none of its scenarios → need attention lists "S1, S2 not covered by any task" for it', async () => {
      await page.goto('/roadmap')
      await page.getByText(/need attention$/).click()
      await expect(page.getByRole('button', { name: `${epic}: S1, S2 not covered by any task` })).toBeVisible()
    })

    await step('Ask the agent for a breakdown of that epic that covers only S1 → the plan card warns "S2 not covered by any task" before Accept', async () => {
      await page.goto('/board')
      await page.getByRole('button', { name: 'Chats (c)' }).click()
      const box = page.getByPlaceholder(/Ask the agent/)
      await box.fill(`coverage probe ${stamp}`)
      await box.press('Enter')
      const note = page.getByRole('note', { name: 'Scenario coverage' })
      await expect(note.getByText('S2 not covered by any task')).toBeVisible()
      await expect(page.getByRole('button', { name: /^Accept/ }).last()).toBeEnabled()
    })
  } finally {
    const { chats } = await (await request.get('/api/conversations')).json() as { chats: { id: string; messages?: unknown[] }[] }
    for (const c of chats.filter((c) => JSON.stringify(c.messages ?? []).includes(`coverage probe ${stamp}`))) {
      await request.post('/api/conversations', { data: { delete: c.id } })
    }
    await request.post('/api/roadmap/delete', { data: { id: epic } })
    await request.post('/api/tasks/delete', { data: { id: task } })
  }
})
