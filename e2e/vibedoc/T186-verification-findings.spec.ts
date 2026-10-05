// T186: verification findings on the task panel and card, on the VibeDoc dev server at :3000.
// Creates its own probe task and deletes it at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T186' })

test('T186 Verification findings', async ({ page, step, request }) => {
  const created = await request.post('/api/tasks/create', { data: { title: `Verification probe ${Date.now()}` } })
  expect(created.ok()).toBe(true)
  const id: string = (await created.json()).task.id
  const report = (findings: unknown[]) => request.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'vibedoc_report_findings', arguments: { taskId: id, findings, sha: 'abc1234' } } },
  })
  const panel = page.getByRole('dialog')
  const verification = panel.getByRole('region', { name: 'Verification' })
  try {
    await step('Report two findings on a task with vibedoc_report_findings → the open task panel shows a Verification block with "critical · 1" and "minor · 1" without a reload', async () => {
      await page.goto(`/board?task=${id}`)
      await expect(panel).toBeVisible()
      await expect(verification).toHaveCount(0)
      const res = await report([
        { severity: 'critical', criterion: 'AC2 "Unknown plan → 400"', message: 'route returns 500', file: 'src/app/api/checkout/route.ts:41' },
        { severity: 'minor', criterion: 'Scope "stale comment"', message: 'comment still says R060' },
      ])
      expect(res.ok()).toBe(true)
      await expect(verification.getByText('critical · 1')).toBeVisible()
      await expect(verification.getByText('minor · 1')).toBeVisible()
      await expect(verification.getByText('src/app/api/checkout/route.ts:41')).toBeVisible()
    })

    await step('Close the panel → the task\'s card shows "1 finding"', async () => {
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
      await expect(page.getByRole('button', { name: new RegExp(`^${id} `) }).getByText('1 finding')).toBeVisible()
    })

    await step('Report again with no findings → the panel reads "Verified: nothing found." and the old findings are gone', async () => {
      await page.goto(`/board?task=${id}`)
      await expect(verification.getByText('critical · 1')).toBeVisible()
      await report([])
      await expect(verification.getByText('Verified: nothing found.')).toBeVisible()
      await expect(verification.getByText('critical · 1')).toHaveCount(0)
    })
  } finally {
    await request.post('/api/tasks/delete', { data: { id } })
  }
})
