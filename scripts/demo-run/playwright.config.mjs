// Config for scripts/demo-run.mjs only: `.demo.ts` files never match a normal `playwright test` run.
export default { testDir: '.', testMatch: '*.demo.ts', retries: 0, workers: 1, reporter: 'list' }
