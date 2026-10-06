// T219: /docs and /explorer in Vietnamese, on the VibeDoc dev server at :3000 (reads docs, writes nothing).
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T219' })

test('T219 Docs and file explorer in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: 'http://localhost:3000' }])

  await step('With Vietnamese on, open /docs → the list says "Tìm tài liệu..." and the empty pane counts "… tệp · … tài liệu"', async () => {
    await page.goto('/docs')
    await expect(page.getByPlaceholder('Tìm tài liệu...')).toBeVisible()
    await expect(page.getByRole('heading', { name: /tệp · \d+ tài liệu|tài liệu trong dự án này/ })).toBeVisible()
  })

  await step('Open the HLD doc → the bar shows "Đã lưu" and the tabs Xem / Chia đôi / Sửa, the side column "Liên kết tới"', async () => {
    await page.goto('/docs?doc=docs%2Farchitecture%2F02-high-level-design%2FHLD.md')
    await expect(page.getByRole('heading', { level: 1, name: 'High-Level Design' }).first()).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Đã lưu' })).toBeVisible()
    for (const tab of ['Xem', 'Chia đôi', 'Sửa']) await expect(page.getByRole('tab', { name: tab })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Tài liệu liên kết' }).getByText('Liên kết tới')).toBeVisible()
  })

  await step('Click "Tài liệu mới" in the list → the dialog says "Chọn mẫu" and the Blank template reads "Tài liệu trống"', async () => {
    await page.getByRole('button', { name: 'Tài liệu mới' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Chọn mẫu' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Tài liệu trống')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  await step('Open /explorer → the views read Cây / Treemap / Bản đồ nhiệt and the pane says "Chọn một tệp để xem chi tiết"', async () => {
    await page.goto('/explorer')
    await expect(page.getByRole('button', { name: 'Cây' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bản đồ nhiệt' })).toBeVisible()
    await expect(page.getByText('Chọn một tệp để xem chi tiết')).toBeVisible()
  })
})
