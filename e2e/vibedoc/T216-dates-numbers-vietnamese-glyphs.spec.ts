// T216: dates by language and the fonts without Vietnamese letters, on the VibeDoc dev server at :3000.
// Vietnamese is set as this test's own cookie, so nothing outlives the test.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T216' })

test('T216 Dates and numbers by language, Vietnamese letters in every font', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: 'http://localhost:3000' }])

  await step('With Vietnamese on, open /activity → today\'s events sit under the heading "Hôm nay"', async () => {
    await page.goto('/activity')
    await expect(page.getByRole('heading', { name: 'Hôm nay' }).first()).toBeVisible()
  })

  await step('Open /roadmap?view=timeline → the month axis reads "thg 10 2026", "thg 11" … with no English month names', async () => {
    await page.goto('/roadmap?view=timeline')
    await expect(page.getByText(/^thg \d+ \d{4}$/).first()).toBeVisible()
    await expect(page.getByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( \d{4})?$/)).toHaveCount(0)
  })

  await step('Open /settings → Atkinson Hyperlegible, DM Sans and DM Mono each say "Không có chữ tiếng Việt"', async () => {
    await page.goto('/settings')
    for (const name of ['Atkinson Hyperlegible', 'DM Sans', 'DM Mono']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('Không có chữ tiếng Việt')
    }
    await expect(page.getByRole('button', { name: /Geist/ }).first()).not.toContainText('Không có chữ tiếng Việt')
  })

  await step('Switch to English and open /activity → the heading reads "Today"', async () => {
    await page.getByRole('radio', { name: 'English' }).click()
    await page.goto('/activity')
    await expect(page.getByRole('heading', { name: 'Today' }).first()).toBeVisible()
  })
})
