// T220: /memory and /activity in Vietnamese, on the VibeDoc dev server at :3000 (reads only).
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T220' })

test('T220 Memory and activity in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: 'http://localhost:3000' }])

  await step('With Vietnamese on, open /memory → the page reads "Bộ nhớ", the list "Mục ghi nhớ" with the type chips quy ước / cạm bẫy / quyết định / sở thích', async () => {
    await page.goto('/memory')
    await expect(page.getByRole('heading', { level: 1, name: 'Bộ nhớ' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mục ghi nhớ' })).toBeVisible()
    for (const type of ['quy ước', 'cạm bẫy', 'quyết định', 'sở thích']) {
      await expect(page.getByRole('group', { name: 'Lọc theo loại' }).getByRole('button', { name: new RegExp(`^${type}`) })).toBeVisible()
    }
  })

  await step('Click "Dọn dẹp" → the panel is titled "Dọn dẹp" and its flags read as Vietnamese sentences ("Bàn giao ghi …")', async () => {
    await page.getByRole('button', { name: /^Dọn dẹp/ }).click()
    const panel = page.getByRole('region', { name: 'Dọn dẹp' })
    await expect(panel.getByRole('heading', { name: 'Dọn dẹp' })).toBeVisible()
    await expect(panel.getByText(/Bàn giao ghi|nhưng mục đó không tồn tại|có vẻ trùng nhau|được dùng|Bộ nhớ đang gọn gàng/).first()).toBeVisible()
  })

  await step('Open /activity → the heading reads "Hoạt động", the toggle "Phiên" / "Mọi sự kiện", and a session headline like "… việc được chuyển"', async () => {
    await page.goto('/activity')
    await expect(page.getByRole('heading', { level: 1, name: 'Hoạt động' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Phiên', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mọi sự kiện' })).toBeVisible()
    await expect(page.getByText(/việc được chuyển|tài liệu thay đổi|lần sửa lộ trình|Đã kết nối, không có thay đổi/).first()).toBeVisible()
  })

  await step('Click "Mọi sự kiện" → the kind filter offers "Việc" and the actor filter "Mọi người" / "Agent" / "Bạn"', async () => {
    await page.getByRole('button', { name: 'Mọi sự kiện' }).click()
    await expect(page.getByRole('group', { name: 'Lọc theo loại' }).getByRole('button', { name: /^Việc/ })).toBeVisible()
    const who = page.getByRole('group', { name: 'Lọc theo người làm' })
    await expect(who.getByRole('button', { name: /^Mọi người/ })).toBeVisible()
    await expect(who.getByRole('button', { name: /^Bạn/ })).toBeVisible()
  })
})
