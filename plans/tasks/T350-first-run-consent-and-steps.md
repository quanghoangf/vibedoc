# T350: Consent card and first-run step events
**Status:** 📋 Todo
**Phase:** R086 — First-run feedback
**Size:** L (half a day)
**Depends on:** —
**Covers:** S1, S2, S3

## Goal
On a project's first open VibeDoc asks once, in plain words, whether to send anonymous first-run steps, and shows the exact request. Opted in, each step (started → agent connected → first roadmap → first task done) is sent once; declined or unanswered, nothing is sent.

## Context
- Epic: `plans/roadmap/R086-first-run-feedback.md`
- Decisions from the breakdown:
  - Transport = the site's GoatCounter (R077, code `vibedoc` in `site/src/data/links.ts`). Events are a plain GET to `https://vibedoc.goatcounter.com/count?p=/first-run/<step>&t=<step>&e=true` sent **from the browser** (`fetch(url, { mode: "no-cors", keepalive: true })`), never from Node: a real browser UA passes GoatCounter's bot filter, and an e2e can intercept it with `page.route`. Don't load GoatCounter's `count.js` (it refuses localhost).
  - The app can't import from `site/`: copy the two constants (`GOATCOUNTER`, `GITHUB`) into the new pure lib with a comment pointing at `site/src/data/links.ts`.
  - Anonymous: the path is only the step id. No run/install id, no project name, path or content. The funnel = count per step path.
  - State per project in its own file `.vibedoc/feedback.json` = `{ consent: boolean | null, answeredAt?, sent: StepId[] }`, not in settings.json (the Settings page PUTs its whole object and would clobber `sent`).
  - On opt-in, steps already reached are added to `sent` without being sent, except `started` (an existing VibeDoc project must not inflate the funnel). Steps reached later are sent once each.
  - Never asked, never sent in demo mode (`isDemo()`), and never when `VIBEDOC_FEEDBACK=0` (CI / e2e escape hatch).
  - Mounted as a non-modal inline card (not role=dialog, so other e2e clicks and Test review keys aren't blocked) from `(app)/layout.tsx`. **Seam for R082:** the welcome screen (R082) can host this same component later; the card stays standalone here.
  - Agent connected = a `session_start` in the activity log (R081's live ✓ is not needed). First roadmap = any roadmap item with a `**Parent:**` (an epic). First task done = any task with status `done`.
- CLAUDE.md: "Only `src/lib/core.ts` touches the file system"; "Always call `emitUpdate()` after any mutation in an API route"; "Never use `localStorage`"; "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`)"; "Pure libs never import values from each other".

## Scope
- [ ] `src/lib/first-run.ts` (pure): `STEPS`, `type StepId`, `reachedSteps({ tasks, roadmap, activity })`, `stepUrl(step)`, `pendingSteps(state, reached)`, `applyConsent(state, consent, reached)`; `src/lib/first-run.check.mts`
- [ ] core: `readFeedback(root)` / `saveFeedback(root, state)` for `.vibedoc/feedback.json`
- [ ] `GET /api/feedback` → `{ consent, pending, demo }` (pending = reached − sent, only when consent is true and not demo / `VIBEDOC_FEEDBACK=0`); `POST /api/feedback { consent }`; `POST /api/feedback/sent { step }`; `emitUpdate` after each write
- [ ] `src/components/layout/FirstRunFeedback.tsx`: the card when `consent === null` ("Help improve VibeDoc?" + what is sent, listing the four step URLs verbatim from `stepUrl`, + what is never sent, Yes / No thanks); when opted in, sends each pending step then POSTs `/sent`; re-checks on SSE `session_start` / `task_updated` / `roadmap_updated` (via AppContext `refresh` data or its own fetch)
- [ ] `src/i18n/feedback.ts` (en + vi), merged in `src/i18n/index.ts`
- [ ] `e2e/stub-chat.mjs` `makeFixture`: write `.vibedoc/feedback.json` `{ "consent": false, "sent": [] }` so existing scripts don't meet the card (scripts that want the card delete it)
- [ ] `e2e/first-run-feedback.mjs` (new): fresh fixture → card shows; No thanks → zero goatcounter requests while a session_start, an epic and a done task appear, card gone after reload; second fixture → Yes → `started` sent once, then agent connected / roadmap / task done each sent once as they happen, request URLs contain nothing but the step
- [ ] CLAUDE.md "VibeDoc writes only" list: add `.vibedoc/feedback.json`

**Out of scope:** Settings toggle (T351), "Stuck? Tell us" link (T352), docs page and funnel script (T353), the R082 welcome screen.

## Files
- `src/lib/first-run.ts`, `src/lib/first-run.check.mts` — new
- `src/lib/core.ts` — `readFeedback` / `saveFeedback` (follow `readSettingsObject` ~line 288 for the `.vibedoc` read)
- `src/app/api/feedback/route.ts`, `src/app/api/feedback/sent/route.ts` — new; demo → `demoForbidden()` on POST (`src/lib/demo.ts`)
- `src/components/layout/FirstRunFeedback.tsx` — new
- `src/app/(app)/layout.tsx` — mount it (not in demo)
- `src/i18n/feedback.ts`, `src/i18n/index.ts`
- `e2e/stub-chat.mjs`, `e2e/first-run-feedback.mjs`
- `CLAUDE.md`

## Implementation notes
- Step ids (they are the wire format, don't rename later): `started`, `agent-connected`, `first-roadmap`, `first-task-done`.
- `// ponytail:` note in first-run.ts: GoatCounter folds visits per IP/day, so two first runs from one IP on one day may count once; fine for a funnel.
- Roadmap items for `reachedSteps` can come from the server side of `GET /api/feedback` (core `listRoadmapItems` or equivalent) rather than the client, so the route derives `pending` alone and the card only sends.
- The i18n e2e (`e2e/i18n.mjs`) checks every page for English text; the card must be fully translated, and it uses `makeFixture`, so it won't see the card unless it removes the file. Add the card to its checked panels if cheap.

## Acceptance criteria
- [ ] Fresh project: the card appears once, lists exactly the URLs that would be requested, and is gone after either answer (also after reload)
- [ ] Opted out or unanswered: no request to `*.goatcounter.com` from any page while steps happen
- [ ] Opted in: each of the four steps is requested exactly once, in the order reached; already-reached steps at opt-in (other than `started`) are not sent
- [ ] Demo mode and `VIBEDOC_FEEDBACK=0`: no card, nothing sent
- [ ] `node src/lib/first-run.check.mts` passes; `e2e/first-run-feedback.mjs` passes; `e2e/i18n.mjs` still passes

## Verify
```bash
node src/lib/first-run.check.mts
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3086 pnpm dev &   # then:
BASE=http://localhost:3086 PW_DIR=. node e2e/first-run-feedback.mjs
BASE=http://localhost:3086 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
- [ ] S1 — WHEN a project is opened in VibeDoc for the first time → THEN a card asks in plain words, shows exactly what would be sent, and doesn't come back once answered
- [ ] S2 — WHEN the user opts in and goes through start → agent connected → first roadmap → first task done → THEN one anonymous event per step is sent
- [ ] S3 — WHEN the user declines, or never answers → THEN no request leaves VibeDoc for the analytics host
- [ ] Human: with a real opt-in from localhost, the `/first-run/started` event shows on the vibedoc.goatcounter.com dashboard
