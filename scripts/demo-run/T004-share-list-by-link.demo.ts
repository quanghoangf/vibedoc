// The demo's evidence run (R085): records T004 against the static Listly mock with VibeDoc's kit.
// Run it with `node scripts/demo-run.mjs`, never on its own (it needs the env the script sets).
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test, expect } from '../../e2e/vibedoc/kit/testing/playwright-fixture'

const app = pathToFileURL(path.resolve(__dirname, '../../examples/demo-runs/listly-app/index.html')).href
test.use({ vibedocTask: 'T004', viewport: { width: 960, height: 600 } })

test('T004 Share a list by link', async ({ page, step }) => {
  await step('Open the "Team groceries" list → it shows its items and a Share button', async () => {
    await page.goto(app)
    await expect(page.getByRole('heading', { name: 'Team groceries' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Items' }).getByRole('listitem')).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  })
  await step('S1 — WHEN an owner turns on the share link and sends it → THEN anyone with the link sees the list, read-only', async () => {
    await page.getByRole('button', { name: 'Share' }).click()
    await page.getByLabel('Anyone with the link can view').check()
    await expect(page.getByText('https://listly.app/l/7f3k9')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto(`${app}?view=shared`)
    await expect(page.getByRole('status')).toHaveText('Shared with you · read-only')
    await expect(page.getByRole('button', { name: 'Add item' })).toHaveCount(0)
  })
  await step('Turn the link off → the old link shows "This list isn\'t shared"', async () => {
    await page.goto(`${app}?link=on`)
    await page.getByRole('button', { name: 'Share' }).click()
    await page.getByLabel('Anyone with the link can view').uncheck()
    await expect(page.getByText('Link is off')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto(`${app}?view=shared&link=off`)
    await expect(page.getByRole('heading', { name: "This list isn't shared" })).toBeVisible()
  })
})
