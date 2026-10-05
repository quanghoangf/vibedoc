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

test.describe('install (T202)', () => {
  const channels = [
    ['npx', 'npx vibedoc'],
    ['npm', 'npm install -g vibedoc'],
    ['pnpm', 'pnpm add -g vibedoc'],
    ['bun', 'bun add -g vibedoc'],
  ] as const

  test('S1: each tab shows and copies exactly its command', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    const tabs = page.getByRole('tablist', { name: 'Install with' })
    for (const [label, command] of channels) {
      await tabs.getByRole('tab', { name: label, exact: true }).click()
      await expect(tabs.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
      const panel = page.getByRole('tabpanel', { name: label, exact: true })
      await expect(panel.getByText(`$ ${command}`, { exact: true })).toBeVisible()
      const copy = panel.getByRole('button', { name: 'Copy install command' })
      await copy.click()
      await expect(copy).toHaveText('Copied')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command)
    }
  })

  test('the tabs work with the keyboard', async ({ page }) => {
    await page.goto('./')
    const tabs = page.getByRole('tablist', { name: 'Install with' })
    await tabs.getByRole('tab', { name: 'npx', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'npm', exact: true })).toBeFocused()
    await expect(tabs.getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: 'bun', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'npx', exact: true })).toBeFocused()
    // Tab leaves the list for the selected panel's Copy button
    await page.keyboard.press('Tab')
    await expect(page.getByRole('tabpanel', { name: 'npx', exact: true }).getByRole('button', { name: 'Copy install command' })).toBeFocused()
  })

  test('"Running in a minute" shows the three steps with their exact commands', async ({ page }) => {
    await page.goto('./#install')
    const install = page.getByRole('region', { name: 'Running in a minute.' })
    await expect(install.getByRole('heading', { level: 3 })).toHaveCount(3)
    await expect(install.getByText('npx vibedoc', { exact: false })).toBeVisible()
    await expect(install.getByText('"url": "http://localhost:<port>/api/mcp"', { exact: false })).toBeVisible()
    await expect(install.getByText('/plugin install vibedoc@vibedoc', { exact: false })).toBeVisible()
  })
})
