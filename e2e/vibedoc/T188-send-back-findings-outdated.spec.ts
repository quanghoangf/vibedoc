// T188: send back picked verification findings from the task panel, on the VibeDoc dev server at :3000.
// Creates its own probe task (in review, three findings) and deletes it at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T188' })

test('T188 Send back selected findings', async ({ page, step, request }) => {
  const created = await request.post('/api/tasks/create', { data: { title: `Send back probe ${Date.now()}` } })
  expect(created.ok()).toBe(true)
  const id: string = (await created.json()).task.id
  const mcp = (name: string, args: Record<string, unknown>) =>
    request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } })
  const panel = page.getByRole('dialog')
  const verification = panel.getByRole('region', { name: 'Verification' })
  try {
    expect((await request.post('/api/tasks', { data: { taskId: id, status: 'review' } })).ok()).toBe(true)
    expect((await mcp('vibedoc_report_findings', { taskId: id, findings: [
      { severity: 'critical', criterion: 'AC1 "Save works"', message: 'Save does nothing', file: 'src/a.ts:3' },
      { severity: 'major', criterion: 'AC2 "Undo"', message: 'Undo restores the wrong item' },
      { severity: 'minor', criterion: 'Scope "label"', message: 'label is lower case' },
    ] })).ok()).toBe(true)

    await step('Open a task in review with a critical, a major and a minor finding → critical and major are checked, minor is not, and the button reads "Send back 2 findings"', async () => {
      await page.goto(`/board?task=${id}`)
      await expect(verification.getByRole('checkbox', { name: 'Send back: AC1 "Save works"' })).toBeChecked()
      await expect(verification.getByRole('checkbox', { name: 'Send back: AC2 "Undo"' })).toBeChecked()
      await expect(verification.getByRole('checkbox', { name: 'Send back: Scope "label"' })).not.toBeChecked()
      await expect(verification.getByRole('button', { name: 'Send back 2 findings' })).toBeVisible()
    })

    await step('Click Send back 2 findings → the panel closes and the task\'s card in Todo shows "changes requested"', async () => {
      await verification.getByRole('button', { name: 'Send back 2 findings' }).click()
      await expect(panel).toHaveCount(0)
      await expect(page.getByRole('button', { name: new RegExp(`^${id} `) }).getByText('changes requested')).toBeVisible()
    })

    await step('Reopen the task → the Review history note lists the two picked findings and not the minor one', async () => {
      await page.goto(`/board?task=${id}`)
      // the whole note, anchored: a third (minor) line would break the match
      await expect(panel.getByText(/^Fix these 2 verification findings:\s+- \[critical\] AC1 "Save works" — Save does nothing · `src\/a\.ts:3`\s+- \[major\] AC2 "Undo" — Undo restores the wrong item$/)).toBeVisible()
    })
  } finally {
    await request.post('/api/tasks/delete', { data: { id } })
  }
})
