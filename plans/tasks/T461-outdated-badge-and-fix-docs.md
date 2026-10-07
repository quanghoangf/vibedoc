# T461: "May be outdated" badge + Fix docs on the doc
**Status:** ✅ Done
**Phase:** R092 — Doc upkeep agent
**Size:** M (2–3 hrs)
**Depends on:** T460
**Covers:** S1, S2

## Goal
An open doc with `outdated-ref` issues shows a "May be outdated" badge in its header listing task + old → new paths, and a Fix docs button that asks the agent to propose the fixes.

## Context
- Epic: `plans/roadmap/R092-doc-upkeep-agent.md`
- Data: `GET /api/docs/lint?path=<doc>` (T460) — no new route. Refetch on the same SSE events as `DocLintPanel` (`RELINT`).
- Fix docs → `askAgent(prompt)` (shown, not a background chat, so the user sees the proposal) (`src/lib/ask-agent.ts`); the demo playground already toasts there. Prompt built by pure `fixDocsPrompt()` in `src/lib/doc-upkeep.ts`: names the doc, each task, the old → new paths, the doc's other lint issues, and says to use `vibedoc_propose_edit` (never write the doc directly) and `vibedoc_check_docs` with the path afterwards. Agent prompts stay English (R078).
- CLAUDE.md: UI text in `src/i18n/docs.ts` (en + vi), `useT()`; Tailwind only; no localStorage.

## Scope
- [ ] `DocUpkeep` component near the doc header in `DocViewer.tsx` (`data-doc-outdated`): amber badge "May be outdated", a list of `T001: src/a.ts → src/b.ts` rows, Fix docs button (`data-fix-docs`).
- [ ] `fixDocsPrompt()` + check cases.
- [ ] e2e `e2e/doc-upkeep.mjs` on a git fixture (style of `e2e/verification.mjs` + `stubChat`): badge shows; Fix docs sends a chat whose message names the doc, T001, `src/a.ts → src/b.ts` and `vibedoc_propose_edit`.

**Out of scope:** Accept round trip and clearing (T462).

## Files
- `src/components/docs/DocUpkeep.tsx` — new
- `src/components/docs/DocViewer.tsx` — mount
- `src/lib/doc-upkeep.ts`, `src/lib/doc-upkeep.check.mts`
- `src/i18n/docs.ts`
- `e2e/doc-upkeep.mjs` — new

## Acceptance criteria
- [ ] S1: the flagged doc shows the badge with `T001` and `src/a.ts → src/b.ts`; an unflagged doc shows nothing.
- [ ] S2: Fix docs posts a chat message naming doc, task, paths, other lint issues and `vibedoc_propose_edit`.
- [ ] vi present; no new lint errors.

## Verify
```bash
node src/lib/doc-upkeep.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3192 pnpm dev   # then: BASE=http://localhost:3192 node e2e/doc-upkeep.mjs
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [x] S1 — WHEN a done task's commits rename or delete a file and a doc still names its old path → THEN the doc header shows "May be outdated" with the task and old → new path (e2e/doc-upkeep.mjs)
- [x] S2 — WHEN the user clicks Fix docs on a flagged doc → THEN the agent chat gets a prompt naming the doc, the task, the old → new paths and other lint issues (e2e/doc-upkeep.mjs)
- [ ] With a real agent connected, click Fix docs → the chat opens and the agent proposes an edit (diff card) instead of writing the doc
- [ ] The amber box sits under the doc properties and reads well in light and dark themes, and at phone width
- [ ] Switch to Tiếng Việt → "Có thể đã lỗi thời" and "Sửa tài liệu"
### Regression risk
- [ ] Opening any unflagged doc shows no box and the title block looks as before
