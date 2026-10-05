// T190: epic scenarios on the roadmap sheet and **Covers:** on the task panel, on the VibeDoc dev server at :3000.
// Creates its own probe epic (under R002) and task, and deletes both at the end.
import { readFileSync, writeFileSync } from 'node:fs'
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T190' })

test('T190 Epic scenarios and Covers', async ({ page, step, request }) => {
  const stamp = Date.now()
  const created = await request.post('/api/tasks/create', { data: { title: `Scenario probe ${stamp}` } })
  expect(created.ok()).toBe(true)
  const task: { id: string; file: string } = (await created.json()).task
  // the test owns this file: add the Covers line under the meta block's Status line
  writeFileSync(task.file, readFileSync(task.file, 'utf8').replace(/^(\*\*Status:\*\*.*)$/m, '$1\n**Covers:** S2'))
  const epicRes = await request.post('/api/roadmap/create', { data: {
    title: `Scenario probe epic ${stamp}`, parent: 'R002', tasks: [task.id],
    body: '## Scenarios\n### S1: Nothing covers this\n- WHEN a\n- THEN b\n\n### S2: The probe task covers this\n- WHEN c\n- THEN d\n',
  } })
  expect(epicRes.ok()).toBe(true)
  const epic: string = (await epicRes.json()).item.id
  try {
    await step('Open the epic on /roadmap → its sheet lists Scenarios S1 and S2, S2 covered by the task and S1 by none', async () => {
      await page.goto(`/roadmap?item=${epic}`)
      const scenarios = page.getByRole('region', { name: 'Scenarios' })
      await expect(scenarios.getByText('Scenarios · 2')).toBeVisible()
      await expect(scenarios.getByRole('listitem', { name: /^S1 / }).getByText('No task covers it')).toBeVisible()
      await expect(scenarios.getByRole('listitem', { name: /^S2 / }).getByRole('button', { name: task.id })).toBeVisible()
    })

    await step('Open the task → its panel shows a Covers row with S2', async () => {
      await page.goto(`/board?task=${task.id}`)
      await expect(page.getByRole('dialog').getByText('Covers', { exact: true })).toBeVisible()
      await expect(page.getByRole('dialog').getByText('S2', { exact: true })).toBeVisible()
    })

    await step('Rename the task → the panel shows the new title and still shows Covers S2', async () => {
      expect((await request.post('/api/tasks/update', { data: { id: task.id, patch: { title: `Renamed probe ${stamp}` } } })).ok()).toBe(true)
      await page.reload()
      await expect(page.getByRole('dialog').getByText(`Renamed probe ${stamp}`).first()).toBeVisible()
      await expect(page.getByRole('dialog').getByText('S2', { exact: true })).toBeVisible()
    })
  } finally {
    await request.post('/api/roadmap/delete', { data: { id: epic } })
    await request.post('/api/tasks/delete', { data: { id: task.id } })
  }
})
