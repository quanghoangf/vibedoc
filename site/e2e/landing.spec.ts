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
    ['Homebrew', 'brew install quanghoangf/vibedoc/vibedoc'],
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

  test('"Ask your AI" copies the whole install prompt (T211)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    await page.getByRole('tablist', { name: 'Install with' }).getByRole('tab', { name: 'Ask your AI', exact: true }).click()
    const panel = page.getByRole('tabpanel', { name: 'Ask your AI', exact: true })
    await expect(panel.getByText('Install VibeDoc (https://github.com/quanghoangf/vibedoc) in this project')).toBeVisible()
    const copy = panel.getByRole('button', { name: 'Copy install prompt' })
    await copy.click()
    await expect(copy).toHaveText('Copied')
    const prompt = await page.evaluate(() => navigator.clipboard.readText())
    for (const part of ['--port 3333', 'claude mcp add --transport http vibedoc http://localhost:3333/api/mcp', 'claude plugin install vibedoc@vibedoc', 'Ask me before any command that needs admin rights', 'Never edit my shell startup files', 'Report back as a checklist']) {
      expect(prompt).toContain(part)
    }
    await panel.getByRole('link', { name: 'Read the full prompt' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Install with your AI assistant' })).toBeVisible()
  })

  test('the tabs work with the keyboard', async ({ page }) => {
    await page.goto('./')
    const tabs = page.getByRole('tablist', { name: 'Install with' })
    await tabs.getByRole('tab', { name: 'npx', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'npm', exact: true })).toBeFocused()
    await expect(tabs.getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: 'Ask your AI', exact: true })).toBeFocused()
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

test.describe('loop and features (T203)', () => {
  const features = [
    ['Board', 'A board your agent moves'],
    ['Roadmap', 'A roadmap that tracks itself'],
    ['Evidence', 'Evidence for every task'],
    ['Scenarios', 'Scenarios as acceptance tests'],
    ['Specs', 'Living capability specs'],
    ['Memory', 'Memory between sessions'],
    ['Link graph', 'Every link, on one map'],
  ] as const

  test('the four loop steps appear in order with their commands', async ({ page }) => {
    await page.goto('./#loop')
    const loop = page.getByRole('region', { name: /Four commands, one loop/ })
    await expect(loop.getByRole('heading', { level: 3 })).toHaveText(['Plan', 'Break down', 'Build and prove', 'Review'])
    await expect(loop.getByRole('listitem')).toHaveCount(4)
    await expect(loop.getByText('/vibedoc:work R004', { exact: true })).toBeVisible()
  })

  test('each of the 7 feature tabs shows its own title, text and screenshot', async ({ page }) => {
    await page.goto('./#features')
    const tabs = page.getByRole('tablist', { name: 'Features' })
    await expect(tabs.getByRole('tab')).toHaveCount(7)
    for (const [label, title] of features) {
      await tabs.getByRole('tab', { name: label, exact: true }).click()
      const panel = page.getByRole('tabpanel', { name: label, exact: true })
      await expect(panel.getByRole('heading', { name: title })).toBeVisible()
      const img = panel.getByRole('img')
      await expect(img).toHaveAttribute('alt', /.+/)
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
    }
    // arrow keys move one tab at a time (setup runs once even though two components use tabs)
    await tabs.getByRole('tab', { name: 'Board', exact: true }).click()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Roadmap', exact: true })).toBeFocused()
  })

  for (const width of [390, 1280]) {
    test(`sections render with their headings and no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('./')
      await expect(page.getByRole('heading', { name: /Four commands, one loop/ })).toBeAttached()
      await expect(page.getByRole('heading', { name: 'One local app for the whole loop.' })).toBeAttached()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  }
})

test.describe('demo video (T204)', () => {
  test('S2: the clip has its poster and captions, and plays inline', async ({ page }) => {
    await page.goto('./#demo')
    const video = page.getByRole('region', { name: /You don't touch anything/ }).locator('video')
    await expect(video).toHaveAttribute('poster', /demo-poster\.jpg$/)
    await expect(video).toHaveAttribute('playsinline', '')
    await expect(video.locator('track[kind="captions"]')).toHaveAttribute('src', /demo\.vtt$/)
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0)
    expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(10)
    await video.evaluate((v: HTMLVideoElement) => v.play())
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.5)
  })
})

test.describe('stars, footer and SEO (T206)', () => {
  test('S3: the footer leads to docs, changelog, npm and GitHub', async ({ page }) => {
    await page.goto('./')
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/vibedoc/docs/')
    await expect(footer.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', /CHANGELOG\.md$/)
    await expect(footer.getByRole('link', { name: 'npm' })).toHaveAttribute('href', 'https://www.npmjs.com/package/vibedoc')
    await expect(footer.getByRole('link', { name: 'VibeDoc on GitHub' })).toHaveAttribute('href', 'https://github.com/quanghoangf/vibedoc')
  })

  test('the star count shows on the GitHub button', async ({ page }) => {
    await page.route('https://api.github.com/repos/quanghoangf/vibedoc', (r) => r.fulfill({ json: { stargazers_count: 1234 } }))
    await page.goto('./')
    const github = page.getByRole('banner').getByRole('link', { name: /GitHub/ })
    await expect(github.getByLabel('1,234 stars')).toHaveText('★ 1.2k')
  })

  test('with the GitHub API blocked the button still reads GitHub, without a count', async ({ page }) => {
    await page.route('https://api.github.com/**', (r) => r.abort())
    await page.goto('./')
    const github = page.getByRole('banner').getByRole('link', { name: /GitHub/ })
    await expect(github).toHaveText('GitHub')
    await expect(github).toHaveAttribute('href', 'https://github.com/quanghoangf/vibedoc')
  })

  test('the closing call to action and the social preview tags are there', async ({ page, request }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: /Give your agent a board/ })).toBeVisible()
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://quanghoangf.github.io/vibedoc/og.png')
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://quanghoangf.github.io/vibedoc/')
    for (const file of ['og.png', 'favicon.svg', 'sitemap-index.xml', 'robots.txt']) {
      expect((await request.get(file)).status(), file).toBe(200)
    }
  })
})

test.describe('spec-driven section (T208)', () => {
  for (const width of [390, 1280]) {
    test(`renders with its heading, both lists and the four example cards at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('./')
      const sdd = page.getByRole('region', { name: 'Vibe coding forgets. Specs remember.' })
      await expect(sdd.getByRole('heading', { name: 'Without specs' })).toBeAttached()
      await expect(sdd.getByRole('heading', { name: 'With VibeDoc' })).toBeAttached()
      const steps = sdd.getByRole('list', { name: 'Spec-driven, step by step' }).getByRole('listitem')
      await expect(steps).toHaveCount(4)
      await expect(sdd.getByText('### Requirement: Session budget', { exact: false })).toBeAttached()
      await expect(sdd.getByText('#### MODIFIED Requirement:', { exact: false })).toBeAttached()
      await expect(sdd.getByText('Send back 2 findings')).toBeAttached()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  }

  test('the nav link "Spec-driven" lands on the section', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Spec-driven' }).click()
    await expect(page).toHaveURL(/#sdd$/)
    await expect(page.getByRole('heading', { name: 'Vibe coding forgets. Specs remember.' })).toBeInViewport()
  })
})

test.describe('watch a task move (focal motion)', () => {
  const opacity = (page, text: string) => page.getByRole('region', { name: 'Watch a task move.' }).getByText(text, { exact: true }).evaluate((e: Element) => getComputedStyle(e).opacity)

  test('with reduced motion the board shows the finished run, nothing hidden', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./')
    const run = page.getByRole('region', { name: 'Watch a task move.' })
    await expect(run.getByText('3/3 passed · video')).toBeVisible()
    await expect.poll(() => opacity(page, '2/4')).toBe('1')
    await expect.poll(() => opacity(page, '1/4')).toBe('0')
    await expect(run.getByText('ready', { exact: true })).toHaveCount(2)
    // no pinned scroll: the section is about one screen tall
    expect(await run.evaluate((e: HTMLElement) => e.offsetHeight)).toBeLessThan(1400)
  })

  test('scrolling through the section plays the run from 1/4 to 2/4', async ({ page }) => {
    await page.goto('./')
    const run = page.getByRole('region', { name: 'Watch a task move.' })
    const { top, height } = await run.evaluate((e: HTMLElement) => ({ top: e.getBoundingClientRect().top + scrollY, height: e.offsetHeight }))
    expect(height).toBeGreaterThan(2000) // pinned stage, scroll-driven
    await page.evaluate((y) => scrollTo(0, y), top)
    await expect.poll(() => opacity(page, '1/4')).toBe('1')
    await expect.poll(() => opacity(page, '2/4')).toBe('0')
    await page.evaluate((y) => scrollTo(0, y), top + height - 900)
    await expect.poll(() => opacity(page, '2/4')).toBe('1')
    await expect(run.getByText('3/3 passed · video')).toBeVisible()
  })
})
