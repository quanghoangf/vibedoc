# T214: Cookie-free site analytics with GoatCounter
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-06
**Phase:** R077 — Site analytics
**Size:** S (1 hr)
**Depends on:** T212, T213

## Goal
We learn which parts of the site lead to installs (visits, install-command copies per channel, demo opens, GitHub clicks) without cookies or personal data.

## Context
- Epic: `plans/roadmap/R077-site-analytics.md`.
- Decision: GoatCounter (free for open source, no cookies, custom events, public dashboard). The human creates the site at goatcounter.com; its code goes in one constant (`GOATCOUNTER` in `site/src/data/links.ts`), and an empty code turns analytics off.
- The view of the numbers is GoatCounter's dashboard (made public in its settings); the site links to it from the footer as "Stats".

## Scope
- [ ] `count.js` loaded async on every landing + docs page (docs via Starlight `head`) when `GOATCOUNTER` is set; GoatCounter itself ignores localhost, so dev and test runs aren't counted
- [ ] Events: `copy-<channel>` on each install Copy (incl. `copy-ai`, `copy-curl`), `demo-play`, `github-<place>` on GitHub links; one delegated listener reading `data-goatcounter-click`
- [ ] Privacy note in the footer: "No cookies. Counts only." linking to the public dashboard

**Out of scope:** telemetry inside the app, A/B tests.

## Acceptance criteria
- [ ] The build includes the script with the right endpoint on landing and docs pages
- [ ] Clicking Copy on an install tab sends a `copy-<id>` event (test intercepts `/count`)
- [ ] No cookies are set (test checks `context.cookies()` is empty)

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [ ] Human setup: sign up at goatcounter.com with the code `vibedoc` (or put your code in `GOATCOUNTER`, `site/src/data/links.ts`), and in its settings make the dashboard public
- [x] 🤖 Load the landing page → a page view is sent to vibedoc.goatcounter.com, and no cookie is set
- [x] 🤖 Copy on the Homebrew and "Ask your AI" tabs → `copy-brew` and `copy-ai` events are sent
- [x] 🤖 Play the demo video → one `demo-play` event, not one per play
- [x] 🤖 Open the docs → the page view is counted
- [x] 🤖 The footer shows "no cookies, counts only" and a Stats link to the public dashboard
- [ ] After deploy: the GoatCounter dashboard shows visits, and copy-* / github-* / demo-play under events for the last 30 days
### Regression risk
- [ ] Copy buttons still put the right text on the clipboard (the click is also counted, nothing else changes)
