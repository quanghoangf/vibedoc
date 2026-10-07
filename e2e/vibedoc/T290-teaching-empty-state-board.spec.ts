// T290: the board's teaching empty state on the VibeDoc dev server (VIBEDOC_URL, default :3000). The project is a
// throwaway empty folder this test owns (the projects list is stubbed to it), removed at the end.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T290' })

test('T290 Teaching empty state on the board', async ({ page, step, context }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t290-'))
  const project = (r: string) => page.route('**/api/projects', (route) => route.fulfill({ json: [{ id: 'fx', name: 'fx', root: r, hasVibedoc: true }] }))
  try {
    await project(root)

    await step('S1 — WHEN the user opens /board in an empty project → THEN it says what fills it and offers one action', async () => {
      await page.goto('/board')
      await expect(page.getByText('No tasks yet')).toBeVisible()
      await expect(page.getByText(/Tasks land here once there's a plan/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Copy /vibedoc:roadmap' })).toBeVisible()
    })

    await step('S2 — WHEN no agent has called VibeDoc yet → THEN the empty state links to Connect', async () => {
      await expect(page.getByText(/Your agent isn't connected yet/)).toBeVisible()
      await page.getByRole('link', { name: /Connect your agent/ }).click()
      await expect(page).toHaveURL(/\/getting-started#3-connect-your-agent$/)
      await expect(page.getByRole('heading', { name: /Connect your agent/ }).first()).toBeVisible()
    })

    await step('With an epic on the roadmap → the board offers /vibedoc:breakdown', async () => {
      mkdirSync(path.join(root, 'plans/roadmap'), { recursive: true })
      writeFileSync(path.join(root, 'plans/roadmap/R001-now.md'), '# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n')
      writeFileSync(path.join(root, 'plans/roadmap/R002-epic.md'), '# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n')
      await page.goto('/board')
      await expect(page.getByRole('button', { name: 'Copy /vibedoc:breakdown' })).toBeVisible()
      await expect(page.getByText(/breaks an epic into steps/)).toBeVisible()
    })

    await step('S3 — WHEN an agent has called VibeDoc → THEN the connect line is gone', async () => {
      const res = await page.request.post(`/api/mcp?root=${encodeURIComponent(root)}`, {
        data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'vibedoc_read_memory', arguments: {} } },
      })
      expect(res.ok()).toBe(true)
      await page.goto('/board')
      await expect(page.getByText('No tasks yet')).toBeVisible()
      await expect(page.getByText(/Your agent isn't connected yet/)).toHaveCount(0)
    })

    await step('S4 — WHEN the language is Tiếng Việt → THEN the empty state is Vietnamese', async () => {
      await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])
      await page.goto('/board')
      await expect(page.getByText('Chưa có việc nào')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sao chép /vibedoc:breakdown' })).toBeVisible()
    })

    await step('A board with tasks whose filter hides them all → still "No tasks match these filters"', async () => {
      await context.addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])
      mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
      writeFileSync(path.join(root, 'plans/tasks/T001-sample.md'), '# T001: Sample\n**Status:** 📋 Todo\n\n## Goal\nA sample.\n')
      await page.goto('/board?view=table&q=zzzz-nothing')
      await expect(page.getByText('No tasks match these filters.')).toBeVisible()
      await expect(page.getByText('No tasks yet')).toHaveCount(0)
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
