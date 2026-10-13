// T525: the welcome's "Pick your toolkit" step on the VibeDoc dev server at :3000 (this repo: Next.js, TS, git).
// Read-only: the server runs the real `claude`, so the spec never confirms an install (Cancel only).
// Installing and a failed install are checked against the fake CLI in e2e/toolkit.mjs.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T525' })

test('T525 Welcome toolkit step', async ({ page, step }) => {
  const toolkit = page.getByRole('region', { name: 'Pick your toolkit' })

  await step('Open /start → "Pick your toolkit" lists Frontend design and Anthropic example skills first, each with its reason', async () => {
    await page.context().addCookies([{ name: 'vibedoc-lang', value: 'en', url: 'http://localhost:3000' }])
    await page.goto('/start')
    // plugins you already have fold into one "Already installed" line; the rows start with the web-frontend fits
    await expect(toolkit.getByText(/Frontend design/)).toBeVisible()
    await expect(toolkit.getByText(/Anthropic example skills/)).toBeVisible()
    await expect(toolkit.getByRole('listitem').first()).toContainText('fits · web frontend')
  })

  await step('Tick a plugin that is not installed and click Install selected → a dialog names it with its claude plugin install command', async () => {
    // the welcome ticks the plugins that fit: untick them so exactly one is picked
    const ticked = toolkit.getByRole('checkbox', { checked: true, disabled: false })
    while (await ticked.count()) await ticked.first().uncheck()
    const box = toolkit.getByRole('checkbox', { disabled: false }).first()
    await box.check()
    await toolkit.getByRole('button', { name: 'Install 1 plugin' }).click()
    const dialog = page.getByRole('dialog', { name: 'Install these plugins in Claude Code?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/^claude plugin install \S+@\S+$/)).toHaveCount(1)
  })

  await step('Click Cancel → the dialog closes and the plugin is still not installed', async () => {
    const dialog = page.getByRole('dialog', { name: 'Install these plugins in Claude Code?' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(toolkit.getByRole('checkbox', { disabled: false }).first()).toBeChecked()
    await expect(toolkit.getByRole('button', { name: 'Install 1 plugin' })).toBeFocused()
  })
})
