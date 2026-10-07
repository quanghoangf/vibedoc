// T332: the demo's sample project shows every part of VibeDoc, on `vibedoc --demo` (VIBEDOC_URL, default :3085:
// start it with `node bin/vibedoc.mjs --demo --port 3085` after `pnpm build`). Reads only.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3085'
test.use({ baseURL: BASE, vibedocTask: 'T332' })

test('T332 Sample project shows every part of VibeDoc', async ({ page, step }) => {
  await step('Open /board → Todo, In progress, Review, Blocked, Paused and Done each have tasks', async () => {
    await page.goto('/board')
    for (const [column, n] of [['Todo', 3], ['In progress', 1], ['Review', 1], ['Blocked', 1], ['Paused', 1], ['Done', 4]] as const) {
      await expect(page.getByText(new RegExp(`^${column}\\s*${n}$`)).first()).toBeVisible()
    }
  })
  await step('Open /chat → three saved chats: "What should I work on next?", "Task T006", "Epic R004"', async () => {
    await page.goto('/chat')
    const list = page.getByRole('main')
    for (const title of ['What should I work on next?', 'Task T006', 'Epic R004']) await expect(list.getByText(title, { exact: true }).first()).toBeVisible()
  })
  await step('Open /roadmap?item=R004 → the sheet lists scenarios S1–S3, S1 and S2 passed', async () => {
    await page.goto('/roadmap?item=R004')
    await expect(page.getByText('Share by link', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Invite by email', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('passed', { exact: true })).toHaveCount(2)
  })
  await step('Open /manual-tests → T006 "Live sync for shared lists" needs you', async () => {
    await page.goto('/manual-tests')
    await expect(page.getByText(/^Needs you\s*1$/).first()).toBeVisible()
    await expect(page.getByText('Live sync for shared lists').first()).toBeVisible()
  })
  await step('Open /activity → events from the last days, newest a day ago', async () => {
    await page.goto('/activity')
    await expect(page.getByText('Yesterday', { exact: true })).toBeVisible()
  })
})
