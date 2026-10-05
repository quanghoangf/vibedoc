import { test, expect } from '@playwright/test'

test.describe('hero (T201)', () => {
  test('one h1, a title and a meta description', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every task your agent finishes comes with proof.')
    await expect(page).toHaveTitle(/VibeDoc/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /proof/)
  })

  test('copy puts exactly `npx vibedoc` on the clipboard and confirms', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    const copy = page.getByRole('button', { name: 'Copy install command' })
    await copy.click()
    await expect(copy).toHaveText('Copied')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx vibedoc')
  })

  test('the GitHub button links to the repo; its icon has no text of its own', async ({ page }) => {
    await page.goto('./')
    const github = page.getByRole('banner').getByRole('link', { name: 'GitHub' })
    await expect(github).toHaveAttribute('href', 'https://github.com/quanghoangf/vibedoc')
    await expect(github.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('the hero is fully visible with no animation', async ({ page }) => {
    await page.goto('./')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    await expect(h1).toHaveCSS('animation-name', 'none')
    await expect(h1).toHaveCSS('opacity', '1')
  })
})
