// T222: /chat and /setup in Vietnamese, on the VibeDoc dev server (VIBEDOC_URL, default :3000).
// Writes nothing: the new chat stays empty (empty chats aren't saved) and the wizard never reaches Write Files.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T222' })

test('T222 Chat, setup and getting started in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])

  await step('With Vietnamese on, open /chat → the list is titled "Trò chuyện" with the button "Trò chuyện mới"', async () => {
    await page.goto('/chat')
    await expect(page.getByRole('heading', { level: 1, name: 'Trò chuyện' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trò chuyện mới' }).first()).toBeVisible()
  })

  await step('Click "Trò chuyện mới" → the empty chat reads "Hỏi agent", suggests "Tôi nên làm gì tiếp theo?" and the box says "Hỏi agent… (Enter để gửi)"', async () => {
    await page.getByRole('button', { name: 'Trò chuyện mới' }).first().click()
    await expect(page.getByRole('heading', { name: 'Hỏi agent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tôi nên làm gì tiếp theo?' })).toBeVisible()
    await expect(page.getByPlaceholder('Hỏi agent… (Enter để gửi)')).toBeVisible()
  })

  await step('Open /setup → "Trình thiết lập", "Bước 1/7" and "Chào mừng đến với VibeDoc"', async () => {
    await page.goto('/setup')
    await expect(page.getByRole('heading', { name: 'Trình thiết lập' })).toBeVisible()
    await expect(page.getByText('Bước 1/7')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Chào mừng đến với VibeDoc' })).toBeVisible()
  })

  await step('Click the "Tối giản" preset → step "Thông tin cơ bản" asks for "Tên dự án"', async () => {
    await page.getByRole('button', { name: /^Tối giản/ }).click()
    await expect(page.getByRole('heading', { name: 'Thông tin cơ bản' })).toBeVisible()
    await expect(page.getByText('Tên dự án')).toBeVisible()
  })
})
