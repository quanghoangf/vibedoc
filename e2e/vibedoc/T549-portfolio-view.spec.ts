// T549: All projects → Portfolio. Builds three temp projects (one with an at-risk epic), adds them to the hub,
// and takes them back out at the end.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.BASE ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T549' })

test('T549 Portfolio view on All projects', async ({ page, step, request }) => {
  const work = mkdtempSync(path.join(os.tmpdir(), 'vibedoc-t549-'))
  const make = (label: string, taskStatus: string) => {
    const root = path.join(work, label.toLowerCase())
    mkdirSync(path.join(root, 'plans/roadmap'), { recursive: true })
    mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
    mkdirSync(path.join(root, '.vibedoc'), { recursive: true })
    writeFileSync(path.join(root, '.vibedoc/feedback.json'), JSON.stringify({ consent: false, sent: [] }))
    writeFileSync(path.join(root, 'plans/roadmap/R001-now.md'), '# R001: Now\n**Status:** in-progress\n**Order:** 10\n')
    writeFileSync(path.join(root, 'plans/roadmap/R002-epic.md'), `# R002: ${label} epic\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001\n`)
    writeFileSync(path.join(root, 'plans/tasks/T001-card.md'), `# T001: ${label} card\n**Status:** ${taskStatus}\n**Phase:** R002\n`)
    return root
  }
  const roots = [make('Kilo', 'in-progress'), make('Lima', 'blocked'), make('Mike', 'in-progress')]
  const res = await request.post('/api/projects/add', { headers: { 'x-vibedoc-cli': '1' }, data: { roots } })
  const ids: string[] = (await res.json()).projects.map((p: { id: string }) => p.id)
  const [kilo, lima, mike] = ids
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])
  const order = () => page.locator('[data-portfolio] > li').evaluateAll((els) => els.map((el) => el.getAttribute('data-portfolio-row')))

  try {
    await step('Open /projects → the List view is selected by default', async () => {
      await page.goto('/projects')
      await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true')
    })

    await step('S1 — WHEN one project has an at-risk epic and the others don\'t → THEN that project sorts first with the epic named', async () => {
      await page.getByRole('button', { name: 'Portfolio', exact: true }).click()
      await expect(page).toHaveURL(/view=portfolio/)
      const row = page.locator(`[data-portfolio-row="${lima}"]`)
      await expect(row.getByRole('button', { name: 'R002 Lima epic is at risk: open it' })).toBeVisible()
      await expect(page.locator(`[data-portfolio-row="${mike}"]`)).toBeVisible()
      const rows = await order()
      expect(rows.indexOf(lima)).toBeLessThan(rows.indexOf(kilo))
      expect(rows.indexOf(lima)).toBeLessThan(rows.indexOf(mike))
    })

    await step('A Portfolio row shows epic progress, blocked tasks and done this week → "0/1 epics", "1 blocked", "🤖 0 · 👤 0 this week"', async () => {
      const row = page.locator(`[data-portfolio-row="${lima}"]`)
      await expect(row.getByText('0/1 epics')).toBeVisible()
      await expect(row.getByText('1 blocked')).toBeVisible()
      await expect(row.getByText('🤖 0 · 👤 0 this week')).toBeVisible()
    })

    await step('At 390px wide → the Portfolio has no horizontal scroll', async () => {
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator(`[data-portfolio-row="${lima}"]`)).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.setViewportSize({ width: 1280, height: 800 })
    })

    await step('Click the at-risk epic chip → that epic opens on its project\'s roadmap', async () => {
      await page.locator(`[data-portfolio-row="${lima}"]`).getByRole('button', { name: 'R002 Lima epic is at risk: open it' }).click()
      await expect(page).toHaveURL(new RegExp(`/roadmap\\?.*item=R002`))
      await expect(page).toHaveURL(new RegExp(`project=${lima}`))
      await expect(page.getByText('Lima epic').first()).toBeVisible()
    })

    await step('Click a project name on the Portfolio → its roadmap opens', async () => {
      await page.goto('/projects?view=portfolio')
      await page.getByRole('button', { name: `Open the roadmap of ${kilo}` }).click()
      await expect(page).toHaveURL(new RegExp(`/roadmap\\?.*project=${kilo}`))
      await expect(page.getByText('Kilo epic').first()).toBeVisible()
    })
  } finally {
    for (const id of ids) await request.post('/api/projects/remove', { data: { id } })
    rmSync(work, { recursive: true, force: true })
  }
})
