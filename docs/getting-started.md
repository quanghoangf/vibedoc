# Getting started

From install to an AI agent moving its first task, in about five minutes.

## 1. Install and start

You need Node.js 20.9 or newer. In the project you want to work on:

```bash
cd your-project
npx vibedoc
```

VibeDoc picks a free port, prints the URL in the terminal and opens the setup wizard (`/setup`) in your browser. The wizard can generate starter docs such as `CLAUDE.md`. It is optional: to skip it, click **Board** in the sidebar. Pin the port with `npx vibedoc --port 3333`.

## 2. Point it at a project

VibeDoc reads the folder you start it in. To use another folder:

```bash
VIBEDOC_ROOT=/path/to/project npx vibedoc
```

Nothing is required up front. VibeDoc shows what it finds:

| Path | What it is |
|------|------------|
| `plans/tasks/T001-*.md` | Tasks, one file each, with a `**Status:**` line |
| `docs/**/*.md` | Docs |
| `memory/MEMORY.md` | The session handoff the agent reads first |
| `CLAUDE.md` | Agent instructions |

To get a first task on the board, create `plans/tasks/T001-hello.md`:

```markdown
# T001: Say hello
**Status:** 📋 Ready

## Goal
Add a hello line to README.md.
```

## 3. Connect your agent

The MCP server is at `http://localhost:<port>/api/mcp` (HTTP JSON-RPC). Use the port from the terminal.

### Claude Code

```bash
claude mcp add --transport http vibedoc http://localhost:<port>/api/mcp
```

Or add it to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "vibedoc": { "type": "http", "url": "http://localhost:<port>/api/mcp" }
  }
}
```

### Cursor

Add the same server to `.cursor/mcp.json` in the project root:

```json
{
  "mcpServers": {
    "vibedoc": { "url": "http://localhost:<port>/api/mcp" }
  }
}
```

Check the connection: ask the agent to "list the VibeDoc tasks". It calls `vibedoc_list_tasks` and you see the board come back.

## 4. Run a first session

Ask the agent to follow this loop. The board updates live while it works.

1. `vibedoc_read_memory`: read the handoff from the last session.
2. `vibedoc_get_status`: see what is active and what is blocked.
3. `vibedoc_get_task T001`, then `vibedoc_update_task T001 in-progress`. The card moves on the board. In an epic, `vibedoc_next_task { epic: "R001" }` claims the next ready task in one call.
4. Do the work.
5. `vibedoc_update_task T001 done`.
6. `vibedoc_update_memory`: write the handoff for the next session.

To make this the default, paste the session protocol from the [README](https://github.com/quanghoangf/vibedoc#recommended-claudemd-snippet) into your project's `CLAUDE.md`.

## 5. Frontend app

If the project has a web frontend, VibeDoc finds it so browser tests can run against it. Open **Settings → Frontend app**.

- **Detection.** VibeDoc reads the root `package.json` and, in a monorepo, every workspace package (npm/yarn `workspaces` or `pnpm-workspace.yaml`). It picks the app that depends on Next, Vite, Remix, Astro, Nuxt, SvelteKit or Create React App, and shows its directory, start command (`npm run dev`, `pnpm --filter web dev`, ...) and URL (from a `--port` flag, else the framework's default port).
- **Override.** Wrong guess? Pick another app, or set the start command, URL or login path, and click **Save**. It is saved as `frontend` in `.vibedoc/settings.json`. Fields you don't change keep following detection. **Reset to detected** removes the override.
- **Playwright.** The tests use the app's own Playwright. If it is missing, Settings shows the install command (`pnpm add -D @playwright/test && npx playwright install chromium`, for example) with **Copy** and **Install** buttons.
- **Dev server.** **Start** reuses the app if its URL already answers, else runs the start command and waits until the URL responds (`frontend.startTimeoutSec` in settings, default 60). **Stop** only stops a server that VibeDoc started.
- **Log in.** Set the login path (for example `/login`), then click **Log in**. A browser window opens at that page. Log in, then close the window. Playwright saves the session to `.vibedoc/auth/storage-state.json`. That folder is git-ignored because it holds live cookies. Every later test loads this session. **Clear session** deletes it.
- **Smoke test.** **Run smoke test** checks the whole setup. VibeDoc starts the app if it is down, opens its first page headless with the saved session, and shows the result: pass or fail, the final URL after redirects, the HTTP status, the duration and a screenshot (`.vibedoc/auth/smoke.png`). If VibeDoc started the app for the test, it stops it again. "Looks logged out" means the page ended on the login path: log in again. "No saved session" means the test ran logged out.

Agents get the same information from the `vibedoc_get_frontend` MCP tool.

## 6. Screenshots and video

Browser tests that use VibeDoc's fixture record what the browser did, so you can see a task working without running anything. `vibedoc_get_frontend` (or a Run from VibeDoc) copies the fixture into your app as a **test kit**, `<testDir>/vibedoc/kit/` (`testDir` from `playwright.config.*`, else `e2e`). Commit it with your specs. It uses your app's own `@playwright/test`, so the specs also run without VibeDoc and in CI. It is rewritten only when VibeDoc's version changes. Specs in `<testDir>/vibedoc/` import it:

```ts
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ vibedocTask: 'T138' })
test('T138', async ({ page, step }) => {
  await step('Open /board → board loads', async () => {
    await page.goto('/board')
    await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible()
  })
})
```

- **`step(name, fn)`.** Each step saves a full-page screenshot `NN-<name>.png`, also when it fails (with the error). Name steps after the checklist items.
- **Video and `run.json`.** Every test records `video.webm` and writes `run.json` (status, commit, steps).
- **Where files go.** `~/.vibedoc/runs/<project>/<taskId>/<runId>/`, outside the repo. The project folder is the project root's folder name.
- **Env vars.** `VIBEDOC_TASK_ID` instead of `test.use({ vibedocTask })`. `VIBEDOC_RUNS_DIR` moves the runs root (set it for VibeDoc too). `VIBEDOC_PROJECT` is the project root when the tests don't run from it. `VIBEDOC_RUNS_KEEP` overrides `runs.keep`.
- **Installed `vibedoc` as a dependency?** `import { test, expect } from 'vibedoc/playwright'` is the same fixture.
- **`runs.keep`.** Only the newest N runs per task are kept: `"runs": { "keep": 5 }` in `.vibedoc/settings.json` (default 5).
- **See a run.** Open the task: the **Runs** section shows each step's screenshot with ✓ or ✗ (click for the full image and the error), the video, and a picker for the kept runs.

## Next

- [MCP tools reference](https://github.com/quanghoangf/vibedoc/blob/main/docs/architecture/mcp-tools.md): every tool and its parameters.
- In the app: **Roadmap** for epics, **Memory** for knowledge entries, **Graph** for links between docs.
