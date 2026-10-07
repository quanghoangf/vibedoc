// T333: the demo's sample test run with a playable video, on `vibedoc --demo` (VIBEDOC_URL, default :3085:
// start it with `node bin/vibedoc.mjs --demo --port 3085` after `pnpm build`). Reads only; the player cookie is this test's own.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3085'
test.use({ baseURL: BASE, vibedocTask: 'T333' })

test('T333 Sample evidence run plays in the demo', async ({ page, step }) => {
  await step('Open /manual-tests?task=T004&view=evidence → "Passed", 3/3 steps passed, with a screenshot per step', async () => {
    await page.goto('/manual-tests?tab=all&task=T004&view=evidence')
    await expect(page.getByText('3/3 steps passed').first()).toBeVisible()
    await expect(page.getByText('Turn the link off → the old link shows "This list isn\'t shared"').first()).toBeVisible()
    const { runs } = await (await page.request.get('/api/tasks/T004/runs')).json()
    await expect(await page.request.get(`/api/tasks/T004/runs/${runs[0].runId}/${runs[0].steps[0].screenshot}`)).toBeOK()
  })
  await step('Open the review view and press Play → the video plays and pauses at "Step 1"', async () => {
    await page.goto('/manual-tests?tab=all&task=T004&view=review')
    const video = page.getByLabel(/^Recording of the/)
    await expect(video).toBeVisible()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByText('Step 1', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(video).not.toHaveJSProperty('currentTime', 0)
  })
})
