# T580: App and browser tab in sync end to end, plus a Desktop app site page
**Status:** 👀 Review
**Phase:** R111 — Desktop app window
**Size:** M
**Depends on:** T578, T579
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
Prove the epic's Done-when: a user works on the board and in a chat in the app while the same project is open in a browser tab, and each sees the other's changes within a second. Document the desktop app on the site.

## Context
- Epic: `plans/roadmap/R111-desktop-app-window.md`. Done when: "a user opens the VibeDoc app, works on the board and in a chat, has the same project open in a browser tab at the same time, and both stay in sync".
- Sync is the existing SSE bus (`/api/events`, `src/lib/events.ts`). The app is just another client, so no product code should be needed. If something doesn't sync, fix it in the web UI, not in `desktop/`.
- Chat in the e2e: stub the agent the way `e2e/stub-chat.mjs` (`stubChat`) does, so no real `claude` runs.

## Scope
- [ ] `e2e/desktop-app.mjs`: S1 section. Launch the app (T2 path: the app starts the hub) and a Chromium page on the same project. Move a task in the app → the browser shows the new column within 1 s. Edit a task title in the browser → the app shows it within 1 s. Send a stubbed chat turn in the app → the chat appears in the browser's /chat list.
- [ ] Run S2, S3 and S4 again in the same script, so one command proves the whole epic
- [ ] Site: a "Desktop app" page (next to the CLI / getting-started pages): what it is, the two modes (reuse vs start), and running it from source until R112 ships installers
- [ ] README: one line linking to that page
- [ ] Mark the epic done once everything is green

**Out of scope:** download links and installers (R112).

## Files
- `e2e/desktop-app.mjs`
- The site's docs page directory (follow the R108 "Agent runs" page from T565), `README.md`, `docs/desktop-app.md`

## Acceptance criteria
- [ ] S1: both directions sync within 1 s in the e2e (board move and title edit), and a chat started in the app shows in the browser.
- [ ] `node e2e/desktop-app.mjs` covers S1–S4 and passes on macOS. Run it on one of Windows / Linux and note the result in the task.
- [ ] The site page builds and is linked from the site nav and the README.

## Verify
```bash
pnpm lint && pnpm build
node e2e/desktop-app.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [x] S1 — WHEN the user has a project open in the desktop app and in a browser tab → THEN a change in one shows in the other within a second
- [ ] Open a project in the app and in Chrome; drag a card to In progress in the app → it moves in the Chrome tab within a second
- [ ] Rename a task in the Chrome tab’s panel → the app shows the new title within a second
- [ ] Start a chat in the app and send a message → the chat appears in Chrome’s /chat list without a reload, and its reply shows there after the turn ends
- [ ] The site’s Docs sidebar has “Desktop app” under Start, and the README links to it
- [ ] `node e2e/desktop-app.mjs` on Windows or Linux
### Regression risk
- [ ] Two browser tabs on /chat: a chat running in one tab is not overwritten by the other tab while it streams
- [ ] _`e2e/desktop-app.mjs` passes on macOS and covers S1–S4 in one run: S1 = a status POST from the app window and a title POST from a Chrome tab (the same calls the board and the panel make) each show on the other side within 1 s, and a stubbed chat started in the app shows in the tab’s /chat. Found while writing it: other clients ignored `chat_saved`, so a chat started elsewhere only showed after a reload; `ChatContext` now adds chats it doesn’t have, takes a newer server copy of one it isn’t running or saving, and drops a deleted one. Re-ran chat-reload, epic-chat-routing, orchestrator, agent-runs (pass). stub-chat (“Charlie task” count 1 ≠ 0) and worker-run (“workers.env passes GITHUB_TOKEN on”) fail the same way without this change (checked on a build without it): not caused here. Site builds and its 40 tests pass. Not run on Windows / Linux._
