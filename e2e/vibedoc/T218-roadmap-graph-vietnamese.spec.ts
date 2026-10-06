// T218: the roadmap and the doc link graph in Vietnamese, on the VibeDoc dev server at :3000 (reads R078, writes nothing).
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T218' })

test('T218 Roadmap and doc graph in Vietnamese', async ({ page, step, context }) => {
  await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: 'http://localhost:3000' }])

  await step('With Vietnamese on, open /roadmap → the view toggle reads "Bản đồ" / "Dòng thời gian" and the buttons "Lập kế hoạch từ spec" and "Chặng"', async () => {
    await page.goto('/roadmap')
    await expect(page.getByRole('button', { name: 'Bản đồ', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dòng thời gian', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Lập kế hoạch từ spec/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Chặng$/ })).toBeVisible()
  })

  await step('Open epic R078 → its sheet lists Trạng thái, "Việc · 10" and "Kịch bản · 5", with a "Sửa" button', async () => {
    await page.goto('/roadmap?item=R078')
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('Trạng thái', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Việc · 10')).toBeVisible()
    await expect(sheet.getByText('Kịch bản · 5')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Sửa' })).toBeVisible()
  })

  await step('Open the sheet\'s ⋯ menu → it offers "Nhân bản" and "Mở tệp"', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Thao tác cho R078' }).click()
    await expect(page.getByRole('menuitem', { name: /Nhân bản/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Mở tệp/ })).toBeVisible()
    await page.keyboard.press('Escape')
  })

  await step('Open /roadmap?view=timeline → the month axis reads "thg …" and no English month name shows', async () => {
    await page.goto('/roadmap?view=timeline')
    await expect(page.getByText(/^thg \d+ \d{4}$/).first()).toBeVisible()
    await expect(page.getByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( \d{4})?$/)).toHaveCount(0)
  })

  await step('Open /graph → the kind chips read "Tài liệu" and "Gần đây", and the search says "Tìm tệp…"', async () => {
    await page.goto('/graph')
    await expect(page.getByRole('button', { name: /^Tài liệu \d+$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Gần đây \d+$/ })).toBeVisible()
    await expect(page.getByPlaceholder('Tìm tệp…')).toBeVisible()
  })
})
