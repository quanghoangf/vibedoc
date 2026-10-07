// T272: a set-up project reopens the last page used (cookie vibedoc-last, R082). A temp project via ?root= (and as the
// only project in /api/projects); the VibeDoc repo itself is never touched. Server: VIBEDOC_URL (default :3000).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T272' })

const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t272-'))
mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
writeFileSync(path.join(root, 'plans/tasks/T001-x.md'), '# T001: First\n**Status:** 📋 Todo\n\n## Goal\nX.\n')
const q = `?root=${encodeURIComponent(root)}`
test.afterAll(() => rmSync(root, { recursive: true, force: true }))

test('T272 Reopen the last page used', async ({ page, step }) => {
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])
  await page.route('**/api/projects', (r) => r.fulfill({ json: [{ id: 'fixture', name: 'fixture', root, hasVibedoc: true }] }))

  await step('Open VibeDoc on a set-up project for the first time → the board opens', async () => {
    await page.goto(`/${q}`)
    await expect(page).toHaveURL(/\/board\b/)
  })

  await step('Go to Roadmap, then open VibeDoc again → the roadmap opens, not the board', async () => {
    await page.getByRole('link', { name: 'Roadmap' }).first().click()
    await expect(page).toHaveURL(/\/roadmap\b/)
    await page.goto(`/${q}`)
    await expect(page).toHaveURL(/\/roadmap\b/)
  })

  await step('Open the setup wizard, then open VibeDoc again → still the roadmap (the wizard is never reopened)', async () => {
    await page.goto(`/setup${q}`)
    await expect(page.getByRole('heading', { name: 'Setup Wizard' })).toBeVisible()
    await page.goto(`/${q}`)
    await expect(page).toHaveURL(/\/roadmap\b/)
  })
})
