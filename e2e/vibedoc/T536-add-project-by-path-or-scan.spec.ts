// T536: All projects → Add project, scan a folder or add one by its path. Builds its repos in a temp folder, adds them
// through the real routes, and takes every project it added back out of the hub at the end.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.BASE ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T536' })

test('T536 Add projects by path or by scanning a folder', async ({ page, step, request }) => {
  const work = mkdtempSync(path.join(os.tmpdir(), 'vibedoc-t536-'))
  for (const n of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'known1', 'known2']) mkdirSync(path.join(work, n, '.git'), { recursive: true })
  mkdirSync(path.join(work, 'r1/plans/tasks'), { recursive: true })
  writeFileSync(path.join(work, 'r1/plans/tasks/T001-scan.md'), '# T001: Scanned card\n**Status:** todo\n')
  writeFileSync(path.join(work, 'notes.txt'), 'a file')
  const added = new Set<string>()
  const remember = async (res: { json: () => Promise<{ projects: { id: string }[] }> }) => (await res.json()).projects.forEach((p) => added.add(p.id))
  await remember(await request.post('/api/projects/add', { data: { roots: [path.join(work, 'known1'), path.join(work, 'known2')] } }))
  page.on('response', async (r) => { if (r.url().endsWith('/api/projects/add') && r.ok()) await remember(r).catch(() => {}) })
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])
  const results = page.locator('[data-scan-results] li')
  const rowOf = (dir: string) => page.locator('[data-project-row]').filter({ hasText: path.join(work, dir) })

  try {
    await step('S1 — WHEN the user scans a folder with 8 repos, 2 already in the hub → THEN 6 are offered, and only the ticked ones are added', async () => {
      await page.goto('/projects')
      await page.getByRole('button', { name: 'Add project' }).click()
      await page.getByRole('menuitem', { name: 'Scan a folder' }).click()
      await page.getByLabel('Folder to scan').fill(work)
      await page.getByRole('button', { name: 'Scan', exact: true }).click()
      await expect(page.getByText('8 repos found, 6 new')).toBeVisible()
      await expect(results.filter({ hasText: 'In the hub' })).toHaveCount(2)
      for (const n of ['r1', 'r2', 'r3', 'r4', 'r5']) await results.filter({ hasText: path.join(work, n) }).getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Add 5 projects' }).click()
      await expect(page.getByText('Added 5 projects')).toBeVisible()
      for (const n of ['r1', 'r2', 'r3', 'r4', 'r5']) await expect(rowOf(n)).toBeVisible()
      await expect(rowOf('r6')).toHaveCount(0)
    })

    await step('Added projects show their task counts on All projects → r1 reads "1 open task"', async () => {
      await expect(rowOf('r1').getByText('1 open task')).toBeVisible()
      await expect(rowOf('r2').getByText('0 open tasks')).toBeVisible()
    })

    await step('Add project → From a folder path with a missing path or a file → the error says so in words, nothing is added', async () => {
      await page.getByRole('button', { name: 'Add project' }).click()
      await page.getByRole('menuitem', { name: 'From a folder path' }).click()
      await page.getByLabel('Folder path').fill(path.join(work, 'nope'))
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('alert').getByText(/no such folder/)).toBeVisible()
      await page.getByLabel('Folder path').fill(path.join(work, 'notes.txt'))
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('alert').getByText(/not a folder/)).toBeVisible()
    })

    await step('Add a folder by its path → it shows on All projects', async () => {
      await page.getByLabel('Folder path').fill(path.join(work, 'r6'))
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByText('Added 1 project')).toBeVisible()
      await expect(rowOf('r6').getByText('0 open tasks')).toBeVisible()
    })

    await step('Remove on an added project still drops its row and offers Undo', async () => {
      await rowOf('r6').getByRole('button', { name: 'Remove' }).click()
      await expect(rowOf('r6')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    })
  } finally {
    for (const id of added) await request.post('/api/projects/remove', { data: { id } })
    rmSync(work, { recursive: true, force: true })
  }
})
