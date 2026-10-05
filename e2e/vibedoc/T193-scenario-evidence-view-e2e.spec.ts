// T193: each epic scenario shows passed / failed / unproven on the roadmap sheet, on the dev server at :3000.
// Creates its own probe task (covers S1, seeded step) and epic (S1–S2), and deletes both at the end.
import { readFileSync, writeFileSync } from 'node:fs'
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T193' })

test('T193 Scenario status on the epic sheet', async ({ page, step, request }) => {
  const stamp = Date.now()
  const created = await request.post('/api/tasks/create', { data: { title: `Proof probe ${stamp}` } })
  expect(created.ok()).toBe(true)
  const task: { id: string; file: string } = (await created.json()).task
  // the test owns this file: covers S1, with the step breakdown would seed
  writeFileSync(task.file, readFileSync(task.file, 'utf8').replace(/^(\*\*Status:\*\*.*)$/m, '$1\n**Covers:** S1')
    .trimEnd() + '\n\n## Manual tests\n_2026-10-05 — ai_\n### Steps\n- [ ] S1 — WHEN a → THEN b\n')
  const epicRes = await request.post('/api/roadmap/create', { data: {
    title: `Proof probe epic ${stamp}`, parent: 'R002', tasks: [task.id],
    body: '## Scenarios\n### S1: Covered and ticked\n- WHEN a\n- THEN b\n\n### S2: Nothing covers it\n- WHEN c\n- THEN d\n',
  } })
  expect(epicRes.ok()).toBe(true)
  const epic: string = (await epicRes.json()).item.id
  const scenario = (id: string) => page.getByRole('region', { name: 'Scenarios' }).getByRole('listitem', { name: new RegExp(`^${id} `) })
  try {
    await step('Open the epic before anything is ticked → S1 and S2 both read "unproven"', async () => {
      await page.goto(`/roadmap?item=${epic}`)
      await expect(scenario('S1').getByText('unproven', { exact: true })).toBeVisible()
      await expect(scenario('S2').getByText('unproven', { exact: true })).toBeVisible()
    })

    await step('Tick the task\'s S1 step → S1 reads "passed" and links to that task\'s evidence; S2 stays "unproven"', async () => {
      expect((await request.post('/api/tasks/manual-tests', { data: { id: task.id, index: 0, checked: true } })).ok()).toBe(true)
      await page.reload()
      const passed = scenario('S1').getByRole('link', { name: 'passed' })
      await expect(passed).toBeVisible()
      await expect(passed).toHaveAttribute('href', `/manual-tests?tab=all&task=${task.id}&view=evidence`)
      await expect(scenario('S2').getByText('unproven', { exact: true })).toBeVisible()
    })
  } finally {
    await request.post('/api/roadmap/delete', { data: { id: epic } })
    await request.post('/api/tasks/delete', { data: { id: task.id } })
  }
})
