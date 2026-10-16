// T537: All projects → Add project → Clone from git. Checks what holds on any server: refused URLs never reach git, and
// a clone that fails shows git's error with nothing left behind. A successful clone (file:// needs VIBEDOC_E2E=1) is
// covered by e2e/projects-hub.mjs.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.BASE ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T537' })

test('T537 Clone a project from a git URL', async ({ page, step }) => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'vibedoc-t537-'))
  await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: BASE }])
  const urlField = page.getByLabel(/^Git URL/)
  const cloneButton = page.getByRole('button', { name: 'Clone', exact: true })

  try {
    await step('All projects → Add project → Clone from git → a dialog asks for the git URL and the folder to clone into', async () => {
      await page.goto('/projects')
      await page.getByRole('button', { name: 'Add project' }).click()
      await page.getByRole('menuitem', { name: 'Clone from git' }).click()
      await expect(page.getByRole('dialog', { name: 'Clone a repo from git' })).toBeVisible()
      await expect(page.getByLabel('Clone into folder')).toBeVisible()
    })

    await step('Paste --upload-pack=… or an ext:: URL → refused in words before git runs, no folder is created', async () => {
      await page.getByLabel('Clone into folder').fill(parent)
      for (const bad of ['--upload-pack=touch /tmp/vibedoc-t537', 'ext::sh -c touch% /tmp/vibedoc-t537']) {
        await urlField.fill(bad)
        await cloneButton.click()
        await expect(page.getByRole('alert')).toContainText('give an https://, ssh:// or git@host:path URL')
      }
      expect(readdirSync(parent)).toEqual([])
      await expect(page.getByRole('dialog', { name: 'Clone a repo from git' })).toBeVisible()
    })

    await step('Clone a repo that can\'t be reached → git\'s error line shows in words, nothing is left in the folder', async () => {
      await urlField.fill('https://127.0.0.1:1/nobody/missing.git')
      await cloneButton.click()
      await expect(page.getByRole('alert')).toContainText(/Could not clone: fatal: .*127\.0\.0\.1/)
      expect(readdirSync(parent)).toEqual([])
      await expect(page.locator('[data-project-row]').filter({ hasText: path.join(parent, 'missing') })).toHaveCount(0)
    })
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})
