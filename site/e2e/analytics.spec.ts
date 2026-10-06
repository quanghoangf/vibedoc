import { test, expect, type Page } from '@playwright/test'

// GoatCounter's own count.js (R077), allowed on localhost; its /count requests are caught here, never sent.
async function recordCounts(page: Page) {
  const hits: string[] = []
  await page.addInitScript(() => { (window as unknown as { goatcounter: object }).goatcounter = { allow_local: true } })
  await page.route('https://vibedoc.goatcounter.com/count**', (route) => {
    hits.push(new URL(route.request().url()).searchParams.get('p') ?? '')
    return route.fulfill({ status: 200, body: '' })
  })
  return hits
}

test.describe('site analytics (T214)', () => {
  test('a page view is counted, and no cookie is set', async ({ page, context }) => {
    const hits = await recordCounts(page)
    await page.goto('./')
    await expect.poll(() => hits.length).toBeGreaterThan(0)
    expect(await context.cookies()).toEqual([])
  })

  test('Copy on an install tab sends copy-<channel>', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const hits = await recordCounts(page)
    await page.goto('./')
    const tabs = page.getByRole('tablist', { name: 'Install with' })
    await tabs.getByRole('tab', { name: 'Homebrew', exact: true }).click()
    await page.getByRole('tabpanel', { name: 'Homebrew', exact: true }).getByRole('button', { name: 'Copy install command' }).click()
    await expect.poll(() => hits).toContain('copy-brew')
    await tabs.getByRole('tab', { name: 'Ask your AI', exact: true }).click()
    await page.getByRole('tabpanel', { name: 'Ask your AI', exact: true }).getByRole('button', { name: 'Copy install prompt' }).click()
    await expect.poll(() => hits).toContain('copy-ai')
  })

  test('playing the demo sends demo-play once', async ({ page }) => {
    const hits = await recordCounts(page)
    await page.goto('./')
    await expect.poll(() => hits.length).toBeGreaterThan(0)
    const video = page.getByLabel(/^Demo:/)
    await video.scrollIntoViewIfNeeded()
    await video.evaluate((v: HTMLVideoElement) => v.play())
    await expect.poll(() => hits).toContain('demo-play')
    await video.evaluate((v: HTMLVideoElement) => { v.pause(); return v.play() })
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
    expect(hits.filter((h) => h === 'demo-play')).toHaveLength(1)
  })

  test('the docs pages are counted too', async ({ page }) => {
    const hits = await recordCounts(page)
    await page.goto('docs/')
    await expect.poll(() => hits.length).toBeGreaterThan(0)
  })

  test('the footer links to the public stats', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Stats' })).toHaveAttribute('href', 'https://vibedoc.goatcounter.com')
    await expect(page.getByRole('contentinfo').getByText('no cookies, counts only')).toBeVisible()
  })
})
