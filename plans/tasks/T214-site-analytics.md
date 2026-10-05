# T214: Cookie-free site analytics with GoatCounter
**Status:** 📋 Todo
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
- [ ] `count.js` loaded async on every landing + docs page (docs via Starlight `head`), only in production builds and only when `GOATCOUNTER` is set
- [ ] Events: `copy-<channel>` on each install Copy (incl. `copy-ai`, `copy-oneliner`), `demo-play`, `github-<place>` on GitHub links; one delegated listener reading `data-goatcounter-click`
- [ ] Privacy note in the footer: "No cookies. Counts only." linking to the public dashboard

**Out of scope:** telemetry inside the app, A/B tests.

## Acceptance criteria
- [ ] A production build includes the script with the right endpoint; `pnpm dev` doesn't
- [ ] Clicking Copy on an install tab sends a `copy-<id>` event (test intercepts `/count`)
- [ ] No cookies are set (test checks `context.cookies()` is empty)

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```
