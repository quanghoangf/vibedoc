// T292: memory, activity and chat empty states on the VibeDoc dev server (VIBEDOC_URL, default :3000). The project is
// a throwaway empty folder this test owns (the projects list is stubbed to it), removed at the end.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T292' })

test('T292 Memory, activity and chat empty states', async ({ page, step, context }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t292-'))
  await page.route('**/api/projects', (route) => route.fulfill({ json: [{ id: 'fx', name: 'fx', root, hasVibedoc: true }] }))
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const empty = page.locator('[data-empty-state]')
  try {
    await step('S1 — WHEN the user opens /memory, /activity, /chat in an empty project → THEN each says what fills it and offers one action', async () => {
      await page.goto('/memory')
      await expect(page.getByText(/At the end of each session your agent writes a handoff here/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Copy lines for CLAUDE.md' })).toBeVisible()
      await page.goto('/activity')
      await expect(page.getByText(/Every move on the board and every call your agent makes/)).toBeVisible()
      await page.goto('/chat')
      await expect(empty.getByText(/Each chat is its own Claude Code session/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'New chat' })).toBeVisible()
    })

    await step('Click Copy lines for CLAUDE.md → the button says Copied', async () => {
      await page.goto('/memory')
      await empty.getByRole('button', { name: 'Copy lines for CLAUDE.md' }).click()
      await expect(empty.getByRole('button', { name: 'Copied' })).toBeVisible()
    })

    await step('S2 — WHEN no agent is connected → THEN Activity and the memory handoff link to Connect', async () => {
      await expect(empty.getByRole('link', { name: /Connect your agent/ })).toHaveAttribute('href', /connect-your-agent/)
      await page.goto('/activity')
      await expect(empty.getByRole('link', { name: /Connect your agent/ })).toHaveAttribute('href', /connect-your-agent/)
    })

    await step('S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese', async () => {
      await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])
      await page.goto('/memory')
      await expect(empty.getByRole('button', { name: 'Sao chép các dòng cho CLAUDE.md' })).toBeVisible()
      await page.goto('/activity')
      await expect(page.getByText('Chưa có hoạt động')).toBeVisible()
      await page.goto('/chat')
      await expect(page.getByText('Hoặc bắt đầu bằng một câu hỏi:')).toBeVisible()
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
