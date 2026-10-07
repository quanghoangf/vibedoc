// T270: `/` picks the first screen from the project (R082). Each step opens its own temp project via ?root= (and as the
// only project in /api/projects), so the VibeDoc repo itself is never read or written. Server: VIBEDOC_URL (default :3000).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T270' })

const made: string[] = []
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vibedoc-t270-'))
  made.push(dir)
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    writeFileSync(path.join(dir, f), body)
  }
  return dir
}
async function openProject(page: Page, root: string) {
  await page.unroute('**/api/projects')
  await page.route('**/api/projects', (r) => r.fulfill({ json: [{ id: 'fixture', name: 'fixture', root, hasVibedoc: true }] }))
  await page.route('**/api/chat**', (r) => r.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"result","is_error":false,"session_id":"s1"}\n' }))
  await page.goto(`/?root=${encodeURIComponent(root)}`)
}
test.afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

test('T270 First-screen decision and the welcome page', async ({ page, step }) => {
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])

  await step('Open VibeDoc on a project with docs and no tasks or roadmap → the welcome shows "Generate roadmap from your docs"', async () => {
    await openProject(page, project({ 'README.md': '# Shop\n', 'docs/prd.md': '# PRD\n\nCheckout.\n' }))
    await expect(page).toHaveURL(/\/start\b/)
    await expect(page.getByRole('button', { name: 'Generate roadmap from your docs' })).toBeVisible()
  })

  await step('Click "Generate roadmap from your docs" → an agent chat opens asking to plan a roadmap from the docs', async () => {
    await page.getByRole('button', { name: 'Generate roadmap from your docs' }).click()
    await expect(page.getByRole('dialog').getByText('Plan a roadmap for this project from its docs.').first()).toBeVisible()
  })

  await step('Open VibeDoc on an empty project → the welcome shows "Plan the first epics with the agent"', async () => {
    await openProject(page, project({ 'LICENSE.md': 'MIT\n' }))
    await expect(page).toHaveURL(/\/start\b/)
    await expect(page.getByRole('button', { name: 'Plan the first epics with the agent' })).toBeVisible()
  })

  await step('Open VibeDoc on a project with a task → the board opens, no welcome', async () => {
    await openProject(page, project({ 'plans/tasks/T001-x.md': '# T001: First\n**Status:** 📋 Todo\n\n## Goal\nX.\n' }))
    await expect(page).toHaveURL(/\/board\b/)
    await expect(page.getByRole('heading', { name: 'Welcome to VibeDoc' })).toHaveCount(0)
  })
})
