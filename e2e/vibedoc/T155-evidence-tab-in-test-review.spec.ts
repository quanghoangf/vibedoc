// T155: Evidence view on /manual-tests. Reads T138's kept runs (needs 2+: run e2e/fixtures/capture-demo.spec.ts twice
// with VIBEDOC_TASK_ID=T138) on the VibeDoc dev server at :3000.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T155' })

test('T155 Evidence tab in Test review', async ({ page, step }) => {
  const evidence = page.getByRole('region', { name: 'Evidence' })
  const history = page.getByRole('navigation', { name: 'Runs' })

  await step('Open /manual-tests?tab=all&task=T138&view=evidence → the Evidence tab is selected and every run step shows its screenshot', async () => {
    await page.goto('/manual-tests?tab=all&task=T138&view=evidence')
    await expect(page.getByRole('tab', { name: 'evidence' })).toHaveAttribute('aria-selected', 'true')
    await expect(evidence.getByRole('img')).toHaveCount(2)
    for (const img of await evidence.getByRole('img').all()) {
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
    }
  })

  await step('Click the older run in History → the URL gets &run= and that run is marked shown', async () => {
    await history.getByRole('button').nth(1).click()
    await expect(page).toHaveURL(/[?&]run=\d{8}T\d{6}Z/)
    await expect(history.getByRole('button').nth(1)).toHaveAttribute('aria-current', 'true')
  })

  await step('Reload → the same run is still shown', async () => {
    await page.reload()
    await expect(history.getByRole('button').nth(1)).toHaveAttribute('aria-current', 'true')
  })

  await step('Click a screenshot → it opens large in a dialog; Esc closes the dialog and the task stays open', async () => {
    await evidence.getByRole('img').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(evidence).toBeVisible()
  })

  await step('Press v → the Review view (run player and checklist) shows and view=evidence leaves the URL', async () => {
    await page.keyboard.press('v')
    await expect(page.getByRole('tab', { name: 'review' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Checklist' })).toBeVisible()
    await expect(page).not.toHaveURL(/view=evidence/)
  })
})
