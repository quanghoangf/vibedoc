// T224: R078's Done-when end to end on the VibeDoc dev server (VIBEDOC_URL, default :3000). The language is this
// test's own browser cookie; nothing is written to the project.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T224' })

test('T224 Every-page Vietnamese sweep, docs, and close R078', async ({ page, step }) => {
  await step('Open Settings and pick Tiếng Việt → the sidebar reads Bảng / Lộ trình at once, without a reload', async () => {
    await page.goto('/settings')
    await page.getByRole('radio', { name: 'Tiếng Việt' }).click()
    await expect(page.getByRole('link', { name: 'Bảng' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Lộ trình' }).first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  })

  await step('Reload /board → it stays Vietnamese (heading "Bảng")', async () => {
    await page.goto('/board')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bảng' })).toBeVisible()
  })

  await step('Open the roadmap Timeline → the month axis reads "thg N YYYY"', async () => {
    await page.goto('/roadmap?view=timeline')
    await expect(page.getByText(/^thg \d+ \d{4}$/).first()).toBeVisible()
  })

  await step('Open Settings → fonts without Vietnamese letters say "Không có chữ tiếng Việt"', async () => {
    await page.goto('/settings')
    await expect(page.getByText(/Không có chữ tiếng Việt/).first()).toBeVisible()
  })

  await step('Pick English → the sidebar reads Board again, without a reload', async () => {
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('link', { name: 'Board' }).first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
