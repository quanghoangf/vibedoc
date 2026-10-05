import { test, expect } from '@playwright/test'
import { tools } from '../src/data/tools'

test.describe('docs site (T210)', () => {
  test('the landing page Docs link opens Getting started', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('banner').getByRole('link', { name: 'Docs', exact: true }).click()
    await expect(page).toHaveURL(/\/vibedoc\/docs\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible()
  })

  test('the sidebar has the guides and the concepts', async ({ page }) => {
    await page.goto('docs/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const name of ['Getting started', 'Install with your AI assistant', 'Skills (/vibedoc:*)', 'Troubleshooting', 'Tasks and the board', 'Roadmap and epics', 'Memory', 'Capability specs', 'Evidence and test runs']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeAttached()
    }
  })

  test('search finds a tool', async ({ page }) => {
    await page.goto('docs/')
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('dialog', { name: 'Search' }).getByRole('textbox', { name: 'Search' }).fill('vibedoc_next_task')
    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('link', { name: /vibedoc_next_task/ }).first()).toBeVisible()
  })

  test('every MCP tool is listed and has its own page', async ({ page, request }) => {
    expect(tools.length).toBeGreaterThanOrEqual(45)
    await page.goto('docs/tools/')
    await expect(page.getByRole('main').getByRole('row')).toHaveCount(tools.length + 1)
    for (const t of tools) {
      const res = await request.get(`docs/tools/${t.name}/`)
      expect(res.status(), t.name).toBe(200)
      expect(await res.text(), t.name).toContain('id="parameters"')
    }
  })

  test('a tool page shows its parameters', async ({ page }) => {
    await page.goto('docs/tools/vibedoc_update_task/')
    await expect(page.getByRole('heading', { level: 1, name: 'vibedoc_update_task' })).toBeVisible()
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'taskId', exact: true }) })
    await expect(row.getByRole('cell', { name: 'yes' })).toBeVisible()
  })

  test('links between docs pages resolve', async ({ page, request }) => {
    const pages = ['docs/', 'docs/ai-install/', 'docs/skills/', 'docs/troubleshooting/', 'docs/concepts/tasks/', 'docs/concepts/roadmap/', 'docs/concepts/memory/', 'docs/concepts/specs/', 'docs/concepts/evidence/']
    for (const p of pages) {
      await page.goto(p)
      const hrefs = await page.getByRole('main').locator('a[href^="/vibedoc/docs"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
      for (const href of new Set(hrefs)) {
        expect((await request.get(href!)).status(), `${p} → ${href}`).toBe(200)
      }
    }
  })

  test('the AI install page shows the same prompt as the landing page (T211)', async ({ page }) => {
    await page.goto('docs/ai-install/')
    await expect(page.getByRole('main').getByText('Install VibeDoc (https://github.com/quanghoangf/vibedoc) in this project', { exact: false })).toBeVisible()
    await expect(page.getByRole('main').getByText('claude plugin install vibedoc@vibedoc', { exact: false }).first()).toBeVisible()
  })
})
