---
name: work
description: Work through one VibeDoc roadmap epic (plans/roadmap/R*.md) by itself. It claims the next ready task with vibedoc_next_task, implements it, runs the task's Verify commands, marks it done, commits, and repeats until the epic is finished or needs a human. Use this whenever the user says "work on epic R037", "implement R037", "/vibedoc:work R037", "start the tasks in this epic", "keep going on the epic", "do the next task", or otherwise wants an agent to run an epic's tasks without picking each one by hand.
---

# Work an epic

Run one epic's tasks in order, one at a time, until VibeDoc says the epic is finished or a human is needed. VibeDoc picks the order: `vibedoc_next_task` respects `Depends on`, skips blocked tasks and tasks another agent has claimed, and moves the claimed task to in-progress so the board shows who is working on what. Don't choose tasks yourself, and don't work on a task you did not claim.

**Argument:** an epic id such as `R037`. If there is none, ask which epic to work on (`vibedoc_get_roadmap` lists them). Work on one epic only.

## Before the loop

Read the project's `CLAUDE.md` once. Task files quote the relevant rules, but the commands (build, lint, package manager), bans and commit rules are only in `CLAUDE.md`. You need them for every task.

## The loop

1. **Claim.** Call `vibedoc_next_task { "epic": "<id>" }`. The reply starts with one of three markers:
   - `🔨 Claimed` — go to step 2. The reply contains the full task file.
   - `⏳ Nothing ready` — see the stop rules below.
   - `✅ Epic … is finished` — see the stop rules below.

   If a reply ends with a `🗺️ Roadmap out of sync` hint for this epic (for example, set it to in-progress), apply it with `vibedoc_update_roadmap_item`, so the roadmap matches the board.
2. **Read the task.** If the reply has a `⚠️ Changes requested` line, a human sent this task back from review: that note is the first thing to fix, and the rest of the spec still applies. A `🤖 Last auto run failed` line names the Playwright spec that failed last time: read the failing step in the task's report, and make that spec pass before done. Read its Goal, Scope, Files, Implementation notes, Acceptance criteria and Verify. The task file is the spec. Stay inside its Scope: later tasks in the epic own the rest, and if you do their work now, their diffs will conflict with yours.

   A `## Related spec` block lists requirements of the capability spec you are working in (`vibedoc_get_spec` reads one in full). Keep them true. If the task really has to change one of them, the epic's `## Spec changes` should say so; if it doesn't, do the task as written and say in your report which requirement changed. Never edit `docs/specs/` yourself: a person merges the epic's spec changes when it is done.
3. **Implement** the task, following the project's patterns.
4. **Verify.** Run every command in the task's **Verify** block, and check each acceptance criterion you can check. If something fails and the fix is inside the task's scope, fix it and run Verify again. If the task changed any `.md` file, also call `vibedoc_check_docs { "path": "<file>" }` for each one and fix its errors (broken links, bad frontmatter, spec changes that won't merge) before done; warnings are yours to judge.
5. **Done.** Only when Verify passes: write a manual test report (below). If the task changed something a user sees in the browser, write the spec for it next ([Write the spec](#write-the-spec-ui-tasks)) and run it ([Run the spec](#run-the-spec)): a UI task with a spec is done only when the spec passes. Then call `vibedoc_update_task { "taskId": "<id>", "status": "done", "manualTests": "<report>" }` (plus `"spec": "<path>", "autoResult": "passed"` when you wrote and ran one), then commit that task's changes, following the repo's commit rules (message format, attribution, which files to stage). Each task leaves the app in a working state. When you commit after each task, it is safe to stop at any point, and a human can review or revert one task at a time.

   When your report leaves items for a human (manual items, or 🤖 items no passing run proved), VibeDoc puts the task in **review** instead of done and says so in the reply (`👀 Moved to review, not done`). That is expected: carry on with the next task, since a review only waiting for its checks doesn't hold back its dependents. A person approves it after clicking through.

   Use `"status": "review"` instead of done yourself only when you can't judge the result yourself: a visual or UX change you couldn't look at, a Verify step you couldn't run fully, or a spec that still fails after its retries ([Run the spec](#run-the-spec)). Say why in your report. A task in review holds back the tasks that depend on it until a human approves it, so the default stays done.
6. **Repeat** from step 1. Mark the current task done before you call `vibedoc_next_task` again. If you don't, the task stays in-progress and the queue treats it as claimed by another agent.

## Manual test report

The report is what a person clicks through before they trust "done". It is saved in the task file as `## Manual tests`, shows as a `🧪 0/N` badge on the card, and is ticked off on `/manual-tests`. Write it from what you actually changed, not from the spec:

```md
### Steps
- [ ] Open /roadmap and click an epic → its sheet shows a Chat button next to Edit
- [ ] Click Chat → a chat opens titled "Epic R004" with three suggestions
### Regression risk
- [ ] Dragging a card between board columns still works
```

- 3–8 items, for someone who doesn't read the code: where to go, what to click, and what they should see (`→ expected result`).
- At least one **Regression risk** item: the existing feature your change most likely breaks.
- No item that only repeats a Verify command. Those already ran; the report covers what automation didn't.
- The report is encouraged, never required: a missing one doesn't block anything, but the human then has nothing to check.

## Write the spec (UI tasks)

A checklist item a script can check should not wait for a human. After you draft the report, turn its checkable items into one Playwright spec in the target repo, so the human only clicks through what is left.

**Only UI tasks.** Skip this section when the task changed nothing a user sees in the browser (an MCP tool, a CLI, a pure lib, docs). That task keeps an all-manual report and no `spec`.

1. **Read the app.** Call `vibedoc_get_frontend`. Use what it reports, don't guess: **Dir** (the app folder), **URL**, **Playwright**, **Auth** and **Test kit** (VibeDoc's fixture, which that call writes into `<testDir>/vibedoc/kit/`; commit it with the spec). If it says no frontend is detected or Playwright is not installed, skip the spec and keep the report all-manual (say why in your summary). Don't install Playwright yourself.
2. **Decide per item.** An item is automated only if its expected result (after `→`) can become a real `expect(...)`: visible text, the URL, an element's state (visible, checked, disabled, focused) or a count. It stays manual when it needs judgement ("looks right", "feels smooth", spacing, colours), an external system (email, payment, another service), or setup unrelated to this task (most **Regression risk** items). When unsure, leave it manual.
3. **Write the spec** at `<testDir>/vibedoc/<task file name>.spec.ts` (`plans/tasks/T012-theme-toggle.md` → `T012-theme-toggle.spec.ts`), where `testDir` comes from the app's `playwright.config.*` (relative to the config file), else `e2e`, inside the app **Dir**. Import `test` and `expect` from the **Test kit** path (`./kit/testing/playwright-fixture`), not from `@playwright/test`, and set `test.use({ vibedocTask: '<task id>' })`: the kit records a screenshot per step, a video and the task's evidence doc. One spec per task, one `test()` per spec taking `{ page, step }`, one `await step('<item text>', async () => …)` per automated item, in checklist order, with the item text copied without the `🤖` (VibeDoc matches steps to items by this text). Writing again for the same task replaces the file.
4. **Mark the items.** Prefix exactly the automated items with `🤖 ` in the report (`- [ ] 🤖 Open /settings → …`). Manual items keep no mark.
5. **Link it.** Pass `"spec": "<path>"` to `vibedoc_update_task`, relative to the repo root (with the app **Dir** in front in a monorepo, e.g. `apps/web/e2e/vibedoc/T012-theme-toggle.spec.ts`). The task's checklist header then shows the spec.

Then run it ([Run the spec](#run-the-spec)).

**Spec rules:**

- Locators by role, label or text (`getByRole`, `getByLabel`, `getByText`, `getByTestId` as a last resort), never CSS or XPath selectors.
- No fixed sleeps (`waitForTimeout`, `setTimeout`). Playwright's `expect` and locators already wait.
- Every `step` ends with an `expect` **on the page**: a locator, the page or a response (`expect(page.getByRole(…))`, `expect(page).toHaveURL(…)`). A step without one proves nothing, and an `expect` on a literal (`expect(true).toBe(true)`) counts as none. The kit counts them per step, and a Run from VibeDoc also replays the spec against a blank page: a step that still passes there is flagged too.
- Navigate with paths (`page.goto('/settings')`). If the config has no `use.baseURL`, add `test.use({ baseURL: '<URL from vibedoc_get_frontend>' })`.
- Never script a login (no typed passwords, no secrets in the spec). If **Auth** shows a saved session, reuse it: `test.use({ storageState: '<path to .vibedoc/auth/storage-state.json, relative to the app Dir>' })` (Playwright resolves a relative path from the folder the test runs in, so it is run from the app **Dir**). Without a saved session, leave `storageState` out: a missing file fails every test. If the page needs a login and no session is saved, keep those items manual.
- Assert this task's change only. Don't create or delete data the test doesn't own.
- Keep the spec self-contained: it runs alone and also in the regression suite, one process with every done task's spec. Don't rely on test order or on state another spec left behind.

**Example.** The report

```md
### Steps
- [ ] Open /settings → a "Theme" switch shows, set to Dark
- [ ] Click the Theme switch → the switch reads Light
- [ ] Reload → Light is still selected
- [ ] The light theme looks right on the settings cards
### Regression risk
- [ ] Logging out from the header menu still works
```

becomes this report (three items automated; the visual check and the unrelated regression item stay manual):

```md
### Steps
- [ ] 🤖 Open /settings → a "Theme" switch shows, set to Dark
- [ ] 🤖 Click the Theme switch → the switch reads Light
- [ ] 🤖 Reload → Light is still selected
- [ ] The light theme looks right on the settings cards
### Regression risk
- [ ] Logging out from the header menu still works
```

and `e2e/vibedoc/T012-theme-toggle.spec.ts` (Auth showed a saved session, so the spec reuses it):

```ts
import { test, expect } from './kit/testing/playwright-fixture'

test.use({ baseURL: 'http://localhost:5173', storageState: '.vibedoc/auth/storage-state.json', vibedocTask: 'T012' })

test('T012 Theme toggle on settings', async ({ page, step }) => {
  await step('Open /settings → a "Theme" switch shows, set to Dark', async () => {
    await page.goto('/settings')
    await expect(page.getByRole('switch', { name: 'Theme' })).toBeVisible()
    await expect(page.getByText('Dark', { exact: true })).toBeVisible()
  })
  await step('Click the Theme switch → the switch reads Light', async () => {
    await page.getByRole('switch', { name: 'Theme' }).click()
    await expect(page.getByText('Light', { exact: true })).toBeVisible()
  })
  await step('Reload → Light is still selected', async () => {
    await page.reload()
    await expect(page.getByText('Light', { exact: true })).toBeVisible()
  })
})
```

## Run the spec

"Done" means proven: a UI task with a spec moves to done only when its spec passes. You run it yourself, from your shell.

1. **Have the app up.** If the app's `playwright.config.*` has a `webServer`, Playwright starts the app itself (and reuses one already listening when `reuseExistingServer` is set); do nothing. Otherwise check the **URL** from `vibedoc_get_frontend` first (`curl -sf <URL>`). If it answers, use it: never start a second dev server next to one that is already listening. If it doesn't, start the app with the reported **Start command** in the app **Dir** in the background, wait until the URL answers, and stop it when you are done.
2. **Run** from the app **Dir**: `npx playwright test <spec path relative to Dir>`, e.g. `npx playwright test e2e/vibedoc/T012-theme-toggle.spec.ts`.
3. **Pass** → tick the 🤖 items in the report (`- [x] 🤖 …`): the run proved them, so the human doesn't click through them again. Then call `vibedoc_update_task { "taskId": "<id>", "status": "done", "manualTests": "<report>", "spec": "<path>", "autoResult": "passed" }`. The checklist header then reads `Auto: passed <date>`. If the reply ends with `⚠️ N steps unverified`, those steps passed without proving their item (VibeDoc unticked them): fix the steps with a real `expect` on the page, run the spec again and report again.
4. **Fail** → first decide which side is wrong. Read the failing step and the error. If the code doesn't do what the item says, fix the code. If the test is wrong (a locator that doesn't match what the item describes, a wrong path, a step that depends on data it doesn't own), fix the test. Then run it again. At most 2 retries (3 runs in total).
5. **Still failing after 2 retries** → call `vibedoc_update_task { "taskId": "<id>", "status": "review", "manualTests": "<report>", "spec": "<path>", "autoResult": "failed" }`. Leave the 🤖 items unticked, and add a `### Failing auto run` group at the top of the report with the failing step's text and the important error line, e.g. `- [ ] Step "Click the Theme switch → the switch reads Light" failed: expected "Light", received "Dark"`. Commit as usual. When the task comes back, the claim reply names the spec (`🤖 Last auto run failed`), so the next agent starts there.

**Never weaken an assertion just to get a pass.** Don't delete or loosen an `expect`, drop a step, swap a precise locator for a vague one, add `test.skip` / `.fixme`, add a trivial `expect` to silence an unverified step, or remove the 🤖 mark from an item that the code fails. A green run that no longer checks the item is worse than a red one: the task ends done, and the human trusts it. If the item itself was wrong (the expected result in the report doesn't match what the task asked for), fix the item text and its step together, and say so in your summary.

**Automatic send-backs.** When someone runs a done task's spec from VibeDoc and it fails, the task comes back to the queue on its own: the claim shows `⚠️ Changes requested` with `❌ Step N … · screenshot …` lines and an `Auto-fix attempt k of N` line. Fix the code (or a test that is truly wrong), run the spec, and mark it done as usual. After N failed attempts in a row (`tests.maxAutoFixes`, default 3) the next failure goes to a human instead (review, "needs a human"), so don't try to get under the cap by weakening the spec: the never-weaken rule above applies to every attempt.

A Verify failure still follows the [Failure rule](#failure-rule) (blocked). Review is for a spec that fails while Verify passes: the code may be fine and only a human can tell.

For the example above, a passing run ends with `vibedoc_update_task { "taskId": "T012", "status": "done", "manualTests": "<the report with the three 🤖 items ticked>", "spec": "e2e/vibedoc/T012-theme-toggle.spec.ts", "autoResult": "passed" }`.

## Stop rules

- **`✅ … is finished`:** report the tasks you completed. If the reply suggests setting the epic to done (`vibedoc_update_roadmap_item`), do that. If the epic has `## Spec changes`, end the report by asking the person to merge them (**Merge into capability spec** on the epic's sheet); don't merge them yourself. Then stop.
- **`⏳ Nothing ready` with "Needs a human":** a task is blocked or in review, or depends on one. Report the reasons from the reply exactly as given and stop. Only a human can unblock, approve or send back the task, and if you continue you can only guess.
- **`⏳ Nothing ready` without "Needs a human":** the remaining tasks are in-progress, or they wait on in-progress tasks. Another agent owns those tasks. Report that and stop. Do not take over or re-claim their tasks.

## Failure rule

If Verify fails and you cannot fix it inside the task's scope:

1. Call `vibedoc_update_task { "taskId": "<id>", "status": "blocked" }`.
2. Add a short `## Blocked because` section to the end of the task file: what failed (the command and the important error line) and what a human must decide or fix.
3. Report this and stop. Do not commit the partial work, and do not claim the next task.

Never mark a task done when its Verify failed or was not run. A done task that is not really done breaks every task that depends on it, and the next agent trusts the board.

## Report

At the end, give a short summary: the tasks done (with their commits), the task that is blocked or waiting (with the reason), and why the run stopped.
