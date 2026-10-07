// T271: the welcome's agent row and the optional "Write project docs" wizard (R082). Temp projects via ?root= (and as
// the only project in /api/projects); the VibeDoc repo itself is never touched. Server: VIBEDOC_URL (default :3000).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T271' })

const made: string[] = []
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vibedoc-t271-'))
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
  await page.goto(`/?root=${encodeURIComponent(root)}`)
}
test.afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

test('T271 Welcome agent status, Connect slot, Write project docs', async ({ page, step }) => {
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])

  await step('Open the welcome on a new project no agent has called → it says "No agent has connected yet." with a How to connect link', async () => {
    await openProject(page, project({ 'docs/a.md': '# A\n' }))
    await expect(page).toHaveURL(/\/start\b/)
    await expect(page.getByText('No agent has connected yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'How to connect' })).toBeVisible()
  })

  await step('Click "Write project docs" → the template wizard opens', async () => {
    await page.getByRole('link', { name: 'Write project docs' }).click()
    await expect(page).toHaveURL(/\/setup\b/)
    await expect(page.getByRole('heading', { name: 'Setup Wizard' })).toBeVisible()
  })

  await step('Open the welcome on a project an agent has called → it says "Agent connected"', async () => {
    const event = { id: 'e1', timestamp: new Date().toISOString(), type: 'session_start', actor: 'ai', title: 'Session started' }
    await openProject(page, project({ 'docs/a.md': '# A\n', '.vibedoc-activity.json': JSON.stringify([event]) }))
    await expect(page).toHaveURL(/\/start\b/)
    await expect(page.getByText('Agent connected', { exact: true })).toBeVisible()
  })
})
