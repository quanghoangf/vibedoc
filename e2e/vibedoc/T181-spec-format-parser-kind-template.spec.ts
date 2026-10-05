// T181: Capability spec template, /docs chip and /graph kind, on the VibeDoc dev server at :3000.
// Creates its own docs/specs/t181-e2e-<time>.md and deletes it at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T181' })

test('T181 Capability spec kind and template', async ({ page, step, request }) => {
  const path = `docs/specs/t181-e2e-${Date.now()}.md`
  try {
    await step('Open /docs, click New document → the "Capability spec" template shows with path docs/specs/capability.md', async () => {
      await page.goto('/docs')
      await page.getByRole('button', { name: 'New document' }).click()
      const card = page.getByRole('dialog').getByRole('button', { name: /^Capability spec/ })
      await expect(card).toBeVisible()
      await expect(card).toContainText('docs/specs/capability.md')
    })

    await step('Pick "Capability spec", set the path to a docs/specs/ file and Create → the file shows in the list with a Capability spec chip', async () => {
      await page.getByRole('dialog').getByRole('button', { name: /^Capability spec/ }).click()
      await page.getByRole('dialog').getByRole('textbox').fill(path)
      await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button').and(page.getByTitle(path))).toContainText('Capability spec')
    })

    await step('Open /graph → the kind filter lists "Capability specs" and the new file shows as a Capability spec', async () => {
      await page.goto('/graph')
      await expect(page.getByRole('button', { name: /^Capability specs \d+$/ })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('button', { name: /^Capability spec Capability name, 0 links/ }).first()).toBeVisible()
    })
  } finally {
    await request.delete('/api/docs', { data: { path } })
  }
})
