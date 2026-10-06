// T226: auto-pause at each step and the step caption in the run player, on the VibeDoc dev server (VIBEDOC_URL,
// default :3000). Reads only: it watches T224's recorded run (five timed steps); the player cookie is this test's own.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T226' })

test('T226 Player auto-pause at each step and step caption', async ({ page, step }) => {
  const video = page.getByLabel(/^Recording of the/)

  await step('Open Test review → All → a task with a recorded run → "Pause at each step" is on', async () => {
    await page.goto('/manual-tests?tab=all&task=T224&view=review')
    await expect(page.getByRole('checkbox', { name: 'Pause at each step' })).toBeChecked()
  })

  await step('Press Play → the video stops at the end of step 1 with "Step 1 · <its name>" over it', async () => {
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(video).toHaveJSProperty('paused', true)
    await expect(page.getByText('Step 1', { exact: true })).toBeVisible()
  })

  await step('Press Play again → it plays on and stops at the end of step 2 with "Step 2" shown', async () => {
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByText('Step 2', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(video).toHaveJSProperty('paused', true)
  })
})
