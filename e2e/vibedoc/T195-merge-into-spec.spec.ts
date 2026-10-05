// T195: "Merge into capability spec" on a done epic, on the VibeDoc dev server at :3000.
// Creates its own capability spec and two done epics (one valid change, one broken), and deletes them at the end.
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:3000', vibedocTask: 'T195' })

test('T195 Merge into capability spec', async ({ page, step, request }) => {
  const stamp = Date.now()
  const slug = `merge-probe-${stamp}`
  const path = `docs/specs/${slug}.md`
  expect((await request.post('/api/docs', { data: { path, content: '# Merge probe\n\n## Requirements\n\n### Requirement: Budget\nThe session SHALL fit 2000 tokens.\n\n#### Scenario: Many\n- WHEN many\n- THEN fits\n' } })).ok()).toBe(true)
  const epic = async (title: string, body: string) => {
    const res = await request.post('/api/roadmap/create', { data: { title, parent: 'R002', status: 'done', body } })
    expect(res.ok()).toBe(true)
    return (await res.json()).item.id as string
  }
  const good = await epic(`Merge probe ${stamp}`, `Outcome.\n\n## Spec changes\n### ${slug}\n#### MODIFIED Requirement: Budget\nThe session SHALL fit 3000 tokens.\n`)
  const broken = await epic(`Merge probe broken ${stamp}`, `Outcome.\n\n## Spec changes\n### ${slug}\n#### MODIFIED Requirement: Missing one\nx\n`)
  const footerMerge = page.getByRole('button', { name: 'Merge into capability spec' })
  const dialog = page.getByRole('dialog', { name: new RegExp(`Merge ${good}|Merge ${broken}`) })
  try {
    await step('Open a done epic whose spec changes modify one requirement and click Merge into capability spec → the dialog shows the old line removed and the new line added', async () => {
      await page.goto(`/roadmap?item=${good}`)
      await footerMerge.click()
      const diff = dialog.getByRole('region', { name: path })
      await expect(diff.getByText('− The session SHALL fit 2000 tokens.')).toBeVisible()
      await expect(diff.getByText('+ The session SHALL fit 3000 tokens.')).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Accept' })).toBeEnabled()
    })

    await step('Click Accept → the sheet reads "Capability spec merged" with a link to the spec, and the Merge button is gone', async () => {
      await dialog.getByRole('button', { name: 'Accept' }).click()
      await expect(page.getByText(/^Capability spec merged \d{4}-\d{2}-\d{2}$/)).toBeVisible()
      await expect(page.getByRole('button', { name: path })).toBeVisible()
      await expect(footerMerge).toHaveCount(0)
    })

    await step('Click the spec link → the capability spec opens with the new requirement text', async () => {
      await page.getByRole('button', { name: path }).click()
      await expect(page).toHaveURL(/\/docs/)
      await expect(page.getByText('The session SHALL fit 3000 tokens.').first()).toBeVisible()
    })

    await step('Open a done epic whose change modifies a missing requirement and click Merge → the dialog names "Missing one" and Accept is disabled', async () => {
      await page.goto(`/roadmap?item=${broken}`)
      await footerMerge.click()
      await expect(dialog.getByText('MODIFIED "Missing one": no such requirement in the spec')).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Accept' })).toBeDisabled()
    })
  } finally {
    await request.post('/api/roadmap/delete', { data: { id: good } })
    await request.post('/api/roadmap/delete', { data: { id: broken } })
    await request.delete('/api/docs', { data: { path } })
  }
})
