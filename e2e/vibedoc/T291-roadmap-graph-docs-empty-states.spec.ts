// T291: roadmap, graph, docs and explorer empty states on the VibeDoc dev server (VIBEDOC_URL, default :3000). The
// project is a throwaway empty folder this test owns (the projects list is stubbed to it), removed at the end.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T291' })

test('T291 Roadmap, graph, docs and explorer empty states', async ({ page, step, context }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t291-'))
  await page.route('**/api/projects', (route) => route.fulfill({ json: [{ id: 'fx', name: 'fx', root, hasVibedoc: true }] }))
  const empty = page.locator('[data-empty-state]')
  try {
    await step('S1 — WHEN the user opens /roadmap, /graph, /docs, /explorer in an empty project → THEN each says what fills it and offers one action', async () => {
      await page.goto('/roadmap')
      await expect(page.getByText(/Your horizons \(Now, Next, Later\)/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Copy /vibedoc:roadmap' })).toBeVisible()
      await expect(empty.getByText('Run in Claude Code')).toBeVisible()
      await page.goto('/graph')
      await expect(page.getByText(/This map shows how your docs, epics, tasks and memory link/)).toBeVisible()
      await expect(empty.getByRole('link', { name: 'Go to Docs' })).toBeVisible()
      await page.goto('/docs')
      await expect(page.getByText(/Docs are plain markdown files in your repo/)).toBeVisible()
      await expect(empty.getByRole('button', { name: /New doc/ })).toBeVisible()
      await page.goto('/explorer')
      await expect(page.getByText(/Every markdown file in your repo shows here/)).toBeVisible()
      await expect(empty.getByRole('link', { name: 'Write project docs' })).toHaveAttribute('href', '/setup')
    })

    await step('S2 — WHEN no agent is connected → THEN the roadmap\'s command action has the Connect link', async () => {
      await page.goto('/roadmap')
      await expect(empty.getByRole('link', { name: /Connect your agent/ })).toBeVisible()
      // the other pages' actions don't need the agent
      await page.goto('/explorer')
      await expect(page.getByText(/Your agent isn't connected yet/)).toHaveCount(0)
    })

    await step('With tasks to group → the roadmap\'s primary action is Generate roadmap, with no connect line', async () => {
      mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
      writeFileSync(path.join(root, 'plans/tasks/T001-sample.md'), '# T001: Sample\n**Status:** 📋 Todo\n**Phase:** Phase 1\n\n## Goal\nA sample.\n')
      await page.goto('/roadmap')
      await expect(empty.getByRole('button', { name: 'Generate roadmap' })).toBeVisible()
      await expect(page.getByText(/Your agent isn't connected yet/)).toHaveCount(0)
    })

    await step('S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese', async () => {
      rmSync(path.join(root, 'plans'), { recursive: true, force: true })
      await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])
      await page.goto('/roadmap')
      await expect(page.getByText('Chưa có lộ trình')).toBeVisible()
      await expect(empty.getByText('Chạy trong Claude Code')).toBeVisible()
      await page.goto('/graph')
      await expect(page.getByText('Chưa có gì để vẽ')).toBeVisible()
      await page.goto('/explorer')
      await expect(page.getByText('Chưa có tệp markdown nào')).toBeVisible()
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
