// T221: /manual-tests in Vietnamese (list, detail, evidence view, suite), on the VibeDoc dev server
// (VIBEDOC_URL, default :3000). Reads only; Vietnamese is this test's own cookie.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T221' })

test('T221 Test review and evidence in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])

  await step('With Vietnamese on, open /manual-tests → the page reads "Duyệt kiểm thử" with the tabs Cần bạn / Lỗi / Đạt / Chập chờn / Chưa chạy / Tất cả / Bộ kiểm thử', async () => {
    await page.goto('/manual-tests')
    await expect(page.getByRole('heading', { level: 1, name: 'Duyệt kiểm thử' })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Lọc theo kết quả' })
    for (const tab of ['Cần bạn', 'Lỗi', 'Đạt', 'Chập chờn', 'Chưa chạy', 'Tất cả', 'Bộ kiểm thử']) {
      await expect(tabs.getByRole('button', { name: new RegExp(`^${tab}`) })).toBeVisible()
    }
  })

  await step('Open the All tab and pick a task in review → the detail shows "Mở việc", the view toggle duyệt / bằng chứng and "Đang chờ bạn duyệt"', async () => {
    await page.goto('/manual-tests?tab=all&task=T215&view=review')
    await expect(page.getByRole('link', { name: /Mở việc/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'duyệt', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'bằng chứng', exact: true })).toBeVisible()
    await expect(page.getByText('Đang chờ bạn duyệt').first()).toBeVisible()
  })

  await step('Switch to bằng chứng → the evidence view lists "Lịch sử" with its runs marked đạt / lỗi', async () => {
    await page.getByRole('button', { name: 'bằng chứng', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^Lịch sử/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: /Lịch sử/ }).getByText(/^(đạt|lỗi)$/).first()).toBeVisible()
  })

  await step('Open the Bộ kiểm thử tab → it reads "Bộ kiểm thử hồi quy" with the button "Chạy bộ kiểm thử"', async () => {
    await page.goto('/manual-tests?tab=suite')
    await expect(page.getByRole('heading', { name: 'Bộ kiểm thử hồi quy' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Chạy bộ kiểm thử/ })).toBeVisible()
  })
})
