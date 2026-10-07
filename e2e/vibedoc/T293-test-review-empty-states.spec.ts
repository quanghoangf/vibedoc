// T293: test review, suite and run player empty states on the VibeDoc dev server (VIBEDOC_URL, default :3000). The
// project is a throwaway folder this test owns (the projects list is stubbed to it), removed at the end.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect } from './kit/testing/playwright-fixture'

const BASE = process.env.VIBEDOC_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, vibedocTask: 'T293' })

test('T293 Test review, suite and evidence empty states', async ({ page, step, context }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vibedoc-t293-'))
  await page.route('**/api/projects', (route) => route.fulfill({ json: [{ id: 'fx', name: 'fx', root, hasVibedoc: true }] }))
  const empty = page.locator('[data-empty-state]')
  try {
    await step('S1 — WHEN the user opens test review, the suite tab and evidence with nothing recorded → THEN each says what fills it and offers one action', async () => {
      await page.goto('/manual-tests')
      await expect(page.getByText(/it leaves a checklist and a recorded test run here/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Copy /vibedoc:work' })).toBeVisible()
      await page.goto('/manual-tests?tab=suite')
      await expect(page.getByText(/The regression suite replays the spec of every done task/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Copy /vibedoc:work' })).toBeVisible()
      mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
      writeFileSync(path.join(root, 'plans/tasks/T001-sample.md'), '# T001: Sample\n**Status:** 👀 Review\n\n## Goal\nA.\n\n## Manual tests\n### Steps\n- [ ] Open / → it loads\n')
      await page.goto('/manual-tests?tab=all&task=T001&view=review')
      await expect(empty.getByText('No recorded run yet')).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Copy /vibedoc:work' })).toBeVisible()
    })

    await step('A task with a spec but no run → the run player offers Run the spec', async () => {
      writeFileSync(path.join(root, 'plans/tasks/T001-sample.md'), '# T001: Sample\n**Status:** 👀 Review\n\n## Goal\nA.\n\n## Manual tests\n_2026-10-07 — ai · Spec: `e2e/vibedoc/T001-sample.spec.ts`_\n### Steps\n- [ ] 🤖 Open / → it loads\n')
      await page.goto('/manual-tests?tab=all&task=T001&view=review')
      await expect(empty.getByText(/This task has a spec but no recorded run/)).toBeVisible()
      await expect(empty.getByRole('button', { name: 'Run the spec' })).toBeVisible()
    })

    await step('S2 — WHEN no agent is connected → THEN the /vibedoc:work action has the Connect link', async () => {
      rmSync(path.join(root, 'plans'), { recursive: true, force: true })
      await page.goto('/manual-tests')
      await expect(empty.getByRole('link', { name: /Connect your agent/ })).toHaveAttribute('href', /connect-your-agent/)
    })

    await step('S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese', async () => {
      await context.addCookies([{ name: 'vibedoc-lang', value: 'vi', url: BASE }])
      await page.goto('/manual-tests')
      await expect(page.getByText(/Khi agent làm xong một việc, nó để lại danh sách kiểm/)).toBeVisible()
      await page.goto('/manual-tests?tab=suite')
      await expect(page.getByText('Chưa có spec nào để chạy lại')).toBeVisible()
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
