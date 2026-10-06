// T215: Settings → Language switches the app shell to Vietnamese and back, on the VibeDoc dev server at :3000.
// The language is a cookie in this test's own browser context, so nothing outlives the test.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T215' })

test('T215 Language switch and the app shell in Vietnamese', async ({ page, step }) => {
  const sidebar = page.locator('[data-sidebar="sidebar"]')

  await step('Open /settings → Appearance shows a Language row with English selected and Tiếng Việt next to it', async () => {
    await page.goto('/settings')
    await expect(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Tiếng Việt' })).toHaveAttribute('aria-checked', 'false')
  })

  await step('Click Tiếng Việt → the sidebar reads Bảng, Lộ trình, Tài liệu at once and the header search says Tìm kiếm…', async () => {
    await page.evaluate(() => { (window as unknown as { noReload: boolean }).noReload = true })
    await page.getByRole('radio', { name: 'Tiếng Việt' }).click()
    await expect(sidebar.getByRole('link', { name: /^Bảng/ })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /^Lộ trình/ })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /^Tài liệu/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tìm kiếm…/ })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true)
  })

  await step('Reload → the app is still in Vietnamese', async () => {
    await page.reload()
    await expect(sidebar.getByRole('link', { name: /^Bảng/ })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Tiếng Việt' })).toHaveAttribute('aria-checked', 'true')
  })

  await step('Click English in Settings → the sidebar reads Board again without a reload', async () => {
    await page.evaluate(() => { (window as unknown as { noReload: boolean }).noReload = true })
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(sidebar.getByRole('link', { name: /^Board/ })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true)
  })
})
