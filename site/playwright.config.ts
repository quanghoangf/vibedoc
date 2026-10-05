import { defineConfig, devices } from '@playwright/test'

// Runs against the built site (dist/), served under /vibedoc by e2e/serve.mjs like GitHub Pages.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4321/vibedoc/' },
  webServer: {
    command: 'pnpm build && node e2e/serve.mjs',
    url: 'http://localhost:4321/vibedoc/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
