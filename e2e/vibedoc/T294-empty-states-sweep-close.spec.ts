// T294: R083's Done-when end to end on the VibeDoc dev server (VIBEDOC_URL, default :3000): every (app) page of an
// empty project has a "what fills this" line and one action. The project is a throwaway empty folder this test owns.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T294' })

// Every (app) route but /settings, /setup and /getting-started, which always have content (e2e/empty-states.mjs checks the list)
const PAGES = ['/board', '/roadmap', '/graph', '/docs', '/explorer', '/memory', '/activity', '/chat', '/manual-tests', '/manual-tests?tab=suite']
const AGENT = ['/board', '/roadmap', '/memory', '/manual-tests', '/manual-tests?tab=suite']

test('T294 Every-route empty-state sweep', async ({ page, step, context }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t294-'))
  await page.route('**/api/projects', (route) => route.fulfill({ json: [{ id: 'fx', name: 'fx', root, hasVibedoc: true }] }))
  const empty = page.locator('[data-empty-state]')
  try {
    await step('S1 — WHEN the user opens every page of an empty project → THEN each says what fills it and offers one action', async () => {
      for (const p of PAGES) {
        await page.goto(p)
        await expect(empty, p).toHaveCount(1)
        await expect(empty.locator('[data-empty-action]'), p).toHaveCount(1)
      }
    })

    await step('S2 — WHEN no agent is connected → THEN agent actions link to Connect', async () => {
      for (const p of AGENT) {
        await page.goto(p)
        await expect(empty.getByRole('link', { name: /Connect your agent/ }), p).toBeVisible()
      }
    })

    await step('On a phone (390px), /docs in an empty project shows the docs empty state with New doc', async () => {
      await page.setViewportSize({ width: 390, height: 800 })
      await page.goto('/docs')
      await expect(page.getByText(/Docs are plain markdown files in your repo/)).toBeVisible()
      await expect(empty.getByRole('button', { name: /New doc/ })).toBeVisible()
      await page.setViewportSize({ width: 1400, height: 900 })
    })

    await step('S3 — WHEN an agent has called VibeDoc → THEN the connect lines are gone', async () => {
      const res = await page.request.post(`/api/mcp?root=${encodeURIComponent(root)}`, {
        data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'vibedoc_read_memory', arguments: {} } },
      })
      expect(res.ok()).toBe(true)
      for (const p of AGENT) {
        await page.goto(p)
        await expect(empty, p).toHaveCount(1)
        await expect(empty.getByRole('link', { name: /Connect your agent/ }), p).toHaveCount(0)
      }
    })

    await step('S4 — WHEN the language is Tiếng Việt → THEN every empty state is Vietnamese', async () => {
      await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])
      for (const [p, text] of [['/board', 'Chưa có việc nào'], ['/roadmap', 'Chưa có lộ trình'], ['/graph', 'Chưa có gì để vẽ'], ['/explorer', 'Chưa có tệp markdown nào'], ['/manual-tests', 'Chưa có gì để duyệt']]) {
        await page.goto(p)
        await expect(empty.getByText(text), p).toBeVisible()
      }
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
