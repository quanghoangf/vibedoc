// Demo for the R059 capture fixture: two steps on an inline page, no server needed.
//   VIBEDOC_RUNS_DIR=$(mktemp -d) VIBEDOC_TASK_ID=T138 npx playwright test e2e/fixtures/capture-demo.spec.ts
// CAPTURE_DEMO_FAIL=1 makes step 2 fail (screenshot still saved, run.json status: failed).
import { test, expect } from '../../src/testing/playwright-fixture'

test('capture demo', async ({ page, step }) => {
  await step('Open the page → heading shows', async () => {
    await page.setContent('<h1>Capture demo</h1><button onclick="this.textContent=\'Clicked\'">Click me</button>')
    await expect(page.getByRole('heading')).toHaveText('Capture demo')
  })
  await step('Click the button → it reads Clicked', async () => {
    await page.getByRole('button').click()
    await expect(page.getByRole('button')).toHaveText(process.env.CAPTURE_DEMO_FAIL ? 'Nope' : 'Clicked', { timeout: 1000 })
  })
})
