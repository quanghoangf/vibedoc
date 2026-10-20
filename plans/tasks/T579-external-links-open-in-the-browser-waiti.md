# T579: External links open in the browser; waiting chats notify from the app
**Status:** 👀 Review
**Phase:** R111 — Desktop app window
**Size:** M
**Depends on:** T577
**Covers:** S4
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
In the app, links to other sites open in the user's default browser instead of inside the VibeDoc window. A chat waiting on the user raises a native desktop notification even when the window is just in the background, and clicking it brings the window to that chat.

## Context
- Epic: `plans/roadmap/R111-desktop-app-window.md`
- Links: everything not on the hub's origin goes to `shell.openExternal`. That covers both `window.open` / `target=_blank` (`setWindowOpenHandler`) and in-page navigation (`will-navigate`). Same-origin links stay in the window. Only `http(s):` and `mailto:` go out. Other schemes (`file:`, `javascript:` and so on) are refused.
- Notifications: the web UI already shows a desktop notification for a chat waiting on the user while the tab is hidden (T222; text in `src/i18n/`). In Electron the web `Notification` API maps to native notifications, so **reuse that code path**. The gap: `document.hidden` stays false when the window is unfocused but visible. Widen the condition to "hidden or not focused" (`!document.hasFocus()`), which is also right for browser tabs.
- Clicking the notification: the existing handler navigates to the chat. In the app, the main process also has to show and focus the window (`webContents` `focus`, or `win.show(); win.focus()` from a `notification-click` IPC). Prefer no preload. If focusing needs one, keep it to one tiny `contextBridge` call.
- Optional and cheap: the Dock / taskbar badge (`app.setBadgeCount`) shows the number of waiting chats, read from the `(n) VibeDoc` title the UI already sets (`page-title-updated`).

## Scope
- [ ] `desktop/main.mjs`: `setWindowOpenHandler` + `will-navigate` → external for other origins
- [ ] Notification: widen the trigger condition in the web UI; the window comes to front on click
- [ ] Badge count from the page title
- [ ] `docs/desktop-app.md`: a "Links and notifications" section

**Out of scope:** notification settings and sounds, notifications for anything other than waiting chats.

## Files
- `desktop/main.mjs`
- The component that fires T222's notification (search for `new Notification(` under `src/`)
- `e2e/desktop-app.mjs`: S4 section

## Acceptance criteria
- [ ] S4: clicking a link to another site (e.g. a doc with `https://example.com`) opens nothing new inside the app. e2e stubs `shell.openExternal` through `electronApp.evaluate` and asserts it was called with that URL.
- [ ] A `target=_blank` link to the same origin opens in the app window, not the browser.
- [ ] A `javascript:` or `file:` link does nothing.
- [ ] With the window unfocused, a chat that starts waiting on the user raises a notification (checked by hand on macOS, plus one of Windows / Linux). Clicking it focuses the window on that chat.
- [ ] The browser tab behaviour from T222 is unchanged (hidden tab → notification), and the existing i18n e2e still passes.

## Verify
```bash
pnpm lint && pnpm build
node e2e/desktop-app.mjs
node e2e/i18n.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [x] S4 — WHEN the user clicks a link to another site in the app → THEN it opens in their default browser
- [ ] In the app, open a doc with a link to https://example.com and click it → it opens in your default browser; the VibeDoc window stays on the doc
- [ ] Click a link to another VibeDoc page that opens in a new tab (e.g. a Copy agent link / View as Markdown) → it opens in the same app window, no second window
- [ ] Start a chat, switch to another app (window visible but not focused), and let the agent ask a question → a macOS notification "needs your answer" with the chat title appears; click it → the VibeDoc window comes to the front on that chat
- [ ] The same notification on Windows or Linux
- [ ] With items in the inbox → the Dock icon shows the same number as the window title’s (n)
### Regression risk
- [ ] In a browser, a hidden tab still gets the notification when a chat starts waiting, and a focused tab gets none
- [ ] _`e2e/desktop-app.mjs` S4 section passes (shell.openExternal stubbed: in-page and target=_blank links to other sites go out, file:/javascript: go nowhere, a hub target=_blank link stays in the one window). `e2e/i18n.mjs` passes on a fresh build. Notifications and the badge are not automated: checked by nobody yet._
