// T217: the board in Vietnamese (views, toolbar, task panel), on the VibeDoc dev server at :3000.
// Vietnamese is this test's own cookie; nothing is written.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T217' })

test('T217 Board in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: 'http://localhost:3000' }])

  await step('With Vietnamese on, open /board → the heading reads "Bảng", the columns Cần làm / Đang làm / Chờ duyệt / Xong, and the button "Việc mới"', async () => {
    await page.goto('/board?v=board')
    await expect(page.getByRole('heading', { level: 1, name: 'Bảng' })).toBeVisible()
    for (const col of ['Cần làm', 'Đang làm', 'Chờ duyệt', 'Xong']) {
      await expect(page.getByRole('heading', { level: 2, name: col, exact: true }).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /^Việc mới/ })).toBeVisible()
  })

  await step('Click the "Dạng bảng" tab → the table headers read Tiêu đề, Trạng thái and Phụ trách', async () => {
    await page.getByRole('button', { name: 'Dạng bảng' }).click()
    await expect(page.getByRole('columnheader', { name: 'Tiêu đề' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Trạng thái' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Phụ trách' })).toBeVisible()
  })

  await step('Open a task → the panel lists Trạng thái, Ưu tiên, Phụ trách and Hạn, with "Trò chuyện về việc này"', async () => {
    await page.getByRole('row').nth(2).getByRole('button').first().click()
    const panel = page.getByRole('dialog')
    for (const row of ['Trạng thái', 'Ưu tiên', 'Phụ trách', 'Hạn']) {
      await expect(panel.getByText(row, { exact: true }).first()).toBeVisible()
    }
    await expect(panel.getByRole('button', { name: /Trò chuyện về việc này|Mở trò chuyện/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  })

  await step('Press f → the filter popover says "Hiện việc khi" and offers "Thêm điều kiện"', async () => {
    await page.keyboard.press('f')
    const filter = page.getByRole('dialog', { name: 'Lọc' })
    await expect(filter.getByText('Hiện việc khi')).toBeVisible()
    await expect(filter.getByRole('button', { name: 'Thêm điều kiện' })).toBeVisible()
  })

  await step('Switch to English in Settings and open /board → the heading reads "Board" and the button "New task"', async () => {
    await page.goto('/settings')
    await page.getByRole('radio', { name: 'English' }).click()
    await page.goto('/board')
    await expect(page.getByRole('heading', { level: 1, name: 'Board' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^New task/ })).toBeVisible()
  })
})
