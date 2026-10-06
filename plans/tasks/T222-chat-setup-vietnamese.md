# T222: Chat, setup and getting started in Vietnamese
**Status:** 👀 Review
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T215
**Covers:** S1
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/chat.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/chat.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /chat, the chat modal, /setup and /getting-started to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** other pages; agent messages and prompts; dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/components/chat/*.tsx`: ChatView, ChatModal, ChatContextRail, AgentMark, StatusMarker, PlanCard, ProposalCard, QuestionCard
- `src/app/(app)/chat/page.tsx`
- `src/components/setup/*.tsx`: SetupWizard, BasicInfo, ProjectQuestionnaire, TeamConventions, TechStackInput, TemplateSelector, GenerationPreview
- `src/app/(app)/getting-started/page.tsx`

## Implementation notes
- Agent messages and the prompt sent to `claude -p` stay as they are (the agent's language is out of scope); translate only the chat chrome (Send, Stop, Accept, status "needs you", card buttons).
- Use `e2e/stub-chat.mjs` to show a plan / proposal / question card in the e2e.
- The desktop notification and `(n) VibeDoc` title text are interface text too.

## Acceptance criteria
- [ ] In vi, /chat, the chat modal, /setup and /getting-started show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T222-chat-setup-vietnamese.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [ ] S1 — WHEN the app is in Vietnamese and the user opens /chat, the chat modal, /setup and /getting-started → THEN every interface text is Vietnamese
- [x] 🤖 With Vietnamese on, open /chat → the list is titled "Trò chuyện" with the button "Trò chuyện mới"
- [x] 🤖 Click "Trò chuyện mới" → the empty chat reads "Hỏi agent", suggests "Tôi nên làm gì tiếp theo?" and the box says "Hỏi agent… (Enter để gửi)"
- [x] 🤖 Open /setup → "Trình thiết lập", "Bước 1/7" and "Chào mừng đến với VibeDoc"
- [x] 🤖 Click the "Tối giản" preset → step "Thông tin cơ bản" asks for "Tên dự án"
- [ ] Click a suggestion in Vietnamese → the message sent to the agent is the English prompt, and "Chia nhỏ epic R… thành các việc" still routes to that epic's chat
- [ ] Ask the agent for a breakdown → the plan card reads Kế hoạch / Chấp nhận (n) / Từ chối and the rows fit without overflow
### Regression risk
- [ ] In English, the chat modal, plan card and setup wizard read exactly as before
- [ ] A desktop notification while the tab is hidden says "Agent cần bạn trả lời" in Vietnamese
