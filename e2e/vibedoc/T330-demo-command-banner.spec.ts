// T330: the Demo banner and "Use VibeDoc on my project" on `vibedoc --demo` (VIBEDOC_URL, default :3085:
// start it with `node bin/vibedoc.mjs --demo --port 3085` after `pnpm build`). Reads only.
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3085'
test.use({ baseURL: BASE, vibedocTask: 'T330' })

test('T330 Demo banner and the command for my own project', async ({ page, step }) => {
  await step('Open /board in the demo → the Listly board shows with a "Demo" banner', async () => {
    await page.goto('/board')
    await expect(page.getByRole('region', { name: 'Demo' })).toContainText('temporary copy')
    await expect(page.getByRole('button', { name: /^T005 Invite collaborators/ })).toBeVisible()
  })
  await step('Click "Use VibeDoc on my project" → a dialog shows `cd your-project` and `npx vibedoc` with copy buttons', async () => {
    await page.getByRole('button', { name: 'Use VibeDoc on my project' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('npx vibedoc')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Copy npx vibedoc' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Copy cd your-project' })).toBeVisible()
  })
  await step('The project switcher lists only "listly"', async () => {
    const res = await page.request.get('/api/projects')
    await expect(res).toBeOK()
    expect((await res.json()).map((p: { name: string }) => p.name)).toEqual(['listly'])
  })
})
