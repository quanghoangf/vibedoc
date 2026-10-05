import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseChangelog } from '../src/lib/changelog'

const releases = parseChangelog(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'))

test.describe('changelog (T212)', () => {
  test('the footer Changelog link opens the page', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Changelog' }).click()
    await expect(page).toHaveURL(/\/vibedoc\/changelog\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
  })

  test('every release is listed, newest first, with its groups', async ({ page }) => {
    await page.goto('changelog/')
    const versions = page.getByRole('main').getByRole('heading', { level: 2 })
    await expect(versions).toHaveCount(releases.length)
    await expect(versions.first()).toHaveText(`v${releases[0].version}`)
    await expect(page.getByRole('article').first().getByText('Latest')).toBeVisible()
    await expect(page.getByRole('region', { name: `New in v${releases[0].version}` })).toBeVisible()
  })

  test('a release is linkable from the jump list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('changelog/')
    const v = releases[3].version
    await page.getByRole('navigation', { name: 'Releases' }).getByRole('link', { name: `v${v}` }).click()
    await expect(page).toHaveURL(new RegExp(`#v${v.replaceAll('.', '\\.')}$`))
    await expect(page.getByRole('heading', { level: 2, name: `v${v}` })).toBeInViewport()
  })

  test('the header section links lead back to the home page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('changelog/')
    await page.getByRole('banner').getByRole('link', { name: 'Features' }).click()
    await expect(page).toHaveURL(/\/vibedoc\/#features$/)
  })
})
