// Records the landing page's demo clip (T204): an agent claims a task, finishes it, and the next one opens,
// while the board is open. Uses a temp copy of a small project and the VibeDoc dev server on :3000 (light theme).
//
//   pnpm dev                                    # in the repo root, VibeDoc on :3000
//   PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0 node site/scripts/record-demo.mjs site/public
//
// Writes <out>/demo.webm and <out>/demo-poster.jpg; with ffmpeg on PATH also <out>/demo.mp4 (H.264, for Safari).
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const req = createRequire(path.join(process.env.PW_DIR ?? process.cwd(), 'noop.js'))
const { chromium } = req('playwright')
const OUT = path.resolve(process.argv[2] ?? 'site/public')
const BASE = process.env.BASE ?? 'http://localhost:3000'

// The folder name shows in the app's breadcrumb, so it gets a real-looking name
const fx = path.join(mkdtempSync(path.join(tmpdir(), 'vibedoc-clip-')), 'acme-app')
mkdirSync(path.join(fx, 'plans/roadmap'), { recursive: true })
mkdirSync(path.join(fx, 'plans/tasks'), { recursive: true })
writeFileSync(path.join(fx, 'plans/roadmap/R001-now.md'), '# R001: Now\n**Status:** in-progress\n**Order:** 10\n**Tasks:** —\n')
writeFileSync(path.join(fx, 'plans/roadmap/R002-billing.md'),
  '# R002: Self-serve billing\n**Parent:** R001\n**Status:** in-progress\n**Order:** 10\n**Tasks:** T001, T002, T003, T004\n\nPay without talking to sales.\n')
const task = (id, title, status, deps = '—') => writeFileSync(
  path.join(fx, `plans/tasks/${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`),
  `# ${id}: ${title}\n**Status:** ${status}\n**Phase:** R002 — Self-serve billing\n**Size:** M (2–3 hrs)\n**Depends on:** ${deps}\n\n## Goal\n${title}.\n`)
task('T001', 'Plan catalog', '✅ Done')
task('T002', 'Checkout happy path', '📋 Todo', 'T001')
task('T003', 'Receipts by email', '📋 Todo', 'T002')
task('T004', 'Cancel a subscription', '📋 Todo', 'T002')

const mcp = (name, args) => fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
})

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'light', recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } })
const page = await ctx.newPage()
await page.route('**/api/projects', (r) => r.fulfill({ json: [{ id: 'acme-app', name: 'acme-app', root: fx, hasVibedoc: true }] }))
// Light theme, and no dev-mode overlay in the shot
const tidy = () => page.evaluate(() => {
  document.documentElement.classList.remove('dark')
  document.querySelectorAll('nextjs-portal').forEach((n) => n.remove())
})
const pause = (ms) => page.waitForTimeout(ms)

await page.goto(`${BASE}/board`)
await page.getByText('Checkout happy path').first().waitFor()
await tidy(); await pause(2200)
await mcp('vibedoc_next_task', { epic: 'R002', agent: 'claude-code' })            // ~3 s: T002 → In progress
await pause(800); await tidy(); await pause(2600)
await mcp('vibedoc_update_task', {                                                 // ~6.5 s: T002 → Done
  taskId: 'T002', status: 'done', agent: 'claude-code',
  manualTests: '### Steps\n- [x] Pick Monthly → the checkout opens\n- [x] Pay with a test card → receipt shows',
})
await pause(800); await tidy()
await page.screenshot({ path: path.join(OUT, 'demo-poster.jpg'), type: 'jpeg', quality: 82 })
await pause(2600)
await mcp('vibedoc_next_task', { epic: 'R002', agent: 'claude-code' })            // ~10 s: T003 opens
await pause(800); await tidy(); await pause(3000)

const video = page.video()
await ctx.close(); await browser.close()
const webm = path.join(OUT, 'demo.webm')
renameSync(await video.path(), webm)
rmSync(path.dirname(fx), { recursive: true, force: true })

let ffmpeg = true
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch { ffmpeg = false }
if (ffmpeg) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28',
    '-movflags', '+faststart', '-an', path.join(OUT, 'demo.mp4')])
}
for (const f of ['demo.webm', 'demo-poster.jpg', ...(ffmpeg ? ['demo.mp4'] : [])]) {
  console.log(`${f}  ${(statSync(path.join(OUT, f)).size / 1024 / 1024).toFixed(2)} MB`)
}
if (!ffmpeg) console.log('No ffmpeg on PATH, so no demo.mp4 (Safari needs it). Install it (macOS: brew install ffmpeg) and run this again.')
