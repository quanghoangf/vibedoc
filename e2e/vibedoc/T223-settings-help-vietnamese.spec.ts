// T223: Settings, the Help panel and ⌘K in Vietnamese, on the VibeDoc dev server (VIBEDOC_URL, default :3000). Reads only.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T223' })

test('T223 Settings, help, shortcuts, ⌘K and shared UI in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])

  await step('With Vietnamese on, open /settings → the heading reads "Cài đặt" and the sections Giao diện / Trình soạn thảo / Dự án / Trạng thái / Kỹ năng', async () => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true }).first()).toBeVisible()
    for (const s of ['Giao diện', 'Trình soạn thảo', 'Dự án', 'Trạng thái', 'Kỹ năng']) {
      await expect(page.getByRole('button', { name: s, exact: true })).toBeVisible()
    }
  })

  await step('Click "Trạng thái" → the section explains "Các cột của bảng, theo thứ tự…"', async () => {
    await page.getByRole('button', { name: 'Trạng thái', exact: true }).click()
    await expect(page.getByText(/^Các cột của bảng, theo thứ tự/)).toBeVisible()
  })

  await step('On /board press ? → the Help panel "Trợ giúp" opens', async () => {
    await page.goto('/board')
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('?')
    await expect(page.getByRole('region', { name: 'Trợ giúp' })).toBeVisible()
  })

  await step('Press ⌘K and type "bang" → the "Điều hướng" group offers "Bảng"', async () => {
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type('bang')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Điều hướng')).toBeVisible()
    await expect(dialog.getByText('Bảng', { exact: true }).first()).toBeVisible()
  })
})
