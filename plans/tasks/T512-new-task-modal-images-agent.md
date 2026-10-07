# T512: New Task modal: better form, image attachments, start with the agent
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** L (half a day)
**Covers:** S9

## Goal
The New Task modal is a plain form: free-text Phase ("e.g. 1 — Core"), free-text Depends on ("T001, T003"), a Size select and a small Description box. It doesn't know the project's epics or tasks, can't take a screenshot, and gives no help writing a task an agent can pick up. Make it fast for a human (pickers that know the project, paste an image) and let the user hand the draft to an agent chat that turns it into a well-formed task.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Modal: `src/components/board/NewTaskModal.tsx` (state at lines 28-34: title, phase, size, description, dependsOn), posts to `POST /api/tasks/create` (line 56) → `createTask()` (`src/lib/core.ts:1336`, under `withTaskClaimLock`). Opened from /board (`n`, header button) in `BoardTab.tsx`.
- Pickers to reuse: epics from the roadmap (AppContext / `/api/roadmap`), tasks from AppContext `board`; `InlineSelect` / `TaskFields` styles; `PriorityField`, `StatusIcon`. Setting the epic must also link the task into the epic's `**Tasks:**` — `setTaskEpic` (used by `/api/tasks/update`) already does that.
- Images — nothing exists yet:
  - Storage: write into the project, e.g. `plans/tasks/assets/<taskId>/<n>.png`, referenced from the task body as `![](assets/<taskId>/<n>.png)`. This is a **new VibeDoc write**: add it to CLAUDE.md's "VibeDoc writes only …" list. Only through `core.ts`; images only (png/jpg/webp/gif), size cap (e.g. 5 MB), no SVG.
  - Serving: no route serves project images today (only `/api/frontend/smoke` returns a png). Add `GET /api/files/image?path=` that serves image types from inside the root only (same path guards as `readDoc`), and make `MarkdownRenderer` resolve relative `![]()` sources through it, so the image shows in /docs, the board panel and Test review.
- Agent chat: `askAgent()` (`src/lib/ask-agent.ts`) starts a chat; the chat agent writes tasks only via `vibedoc_propose_plan` (`kind: "breakdown"`, loose tasks or `epic`), which the user previews and Accepts (`src/lib/plan.ts` validates). "Start with agent" sends the draft (title, epic, description, attachment paths) and asks the agent to ask what's missing, then propose the task with Goal / Scope / Files / Acceptance criteria / Verify (the breakdown skill's template).
  - Open fork, decide in the task: the chat's `claude -p` has only VibeDoc MCP tools, so it can't open an image file. Either (a) add an MCP tool `vibedoc_get_attachment { path }` returning MCP `image` content, or (b) pass only the paths and say so. Prefer (a) if `claude -p` accepts image content from MCP tool results — verify first; else (b) and note it.
- Demo playground: `askAgent()` toasts instead of chatting; uploads must be refused there too (`playgroundForbidden()`).
- UI text in `src/i18n/board.ts` (en + vi). Keyboard-first: the modal stays fully usable without a mouse.

## Scope
- [ ] Form: Epic picker (search epics, shows id + title; none = loose task), Depends on as a multi-select of tasks (id + title, status icon), Size and Priority as segmented/inline pickers, a larger Description with markdown hint; ⌘↵ creates
- [ ] Image attach: paste (⌘V), drag-and-drop, or pick a file into the description; thumbnails with remove; on create the images are written under `plans/tasks/assets/<id>/` and linked in the body
- [ ] `GET /api/files/image` + relative image resolution in `MarkdownRenderer`
- [ ] "Start with agent": a secondary action that opens a chat seeded with the draft (and attachments per the fork above); the modal closes, the draft is not lost if the chat is cancelled (kept until the modal is reopened in this session)
- [ ] Validation and errors show `err.response.data.error.message`-style messages from the API, not raw fetch errors
- [ ] `emitUpdate` after the create and the image writes

**Out of scope:** editing attachments of existing tasks, non-image files, image upload from the board task panel

## Files
- `src/components/board/NewTaskModal.tsx`
- `src/app/api/tasks/create/route.ts`, new `src/app/api/tasks/attachments/route.ts`, new `src/app/api/files/image/route.ts`
- `src/lib/core.ts` — `saveTaskAttachment()`, `readProjectImage()`, `createTask` body with image links
- `src/lib/attachments.ts` (+ `.check.mts`) — pure: allowed types, size cap, safe file names, markdown link building
- `src/components/docs/MarkdownRenderer.tsx` — relative image src
- `src/lib/mcp-tools.ts` + `src/app/api/mcp/route.ts` — only if fork (a); update the tool count in the docs
- `src/i18n/board.ts`, `CLAUDE.md` (writes list)
- `e2e/new-task-modal.mjs` — new; copy setup from `e2e/first-week.mjs`

## Acceptance criteria
- [ ] Pick an epic and two dependencies from lists, set size and priority, create → the task file has the right `**Phase:**`, `**Depends on:**`, size, priority, and the epic's `**Tasks:**` lists it
- [ ] Paste a screenshot → thumbnail shows; create → `plans/tasks/assets/<id>/1.png` exists, the body links it, and the image renders in the board panel and /docs
- [ ] A 10 MB file or an SVG is refused with a clear message; a path outside the project can't be read through `/api/files/image`
- [ ] "Start with agent" opens a chat with the draft; the agent's proposal appears as a plan card; Accept creates the task
- [ ] Keyboard only: open with `n`, fill, ⌘↵ creates; Esc closes
- [ ] Light + dark, 390px, Vietnamese labels; demo playground refuses uploads and toasts on the agent action
- [ ] `pnpm build` passes; `node src/lib/attachments.check.mts` passes

## Verify
```bash
node src/lib/attachments.check.mts
pnpm build
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/new-task-modal.mjs
```

## Manual tests
_Report by the implementing agent. Verify ran: `node src/lib/attachments.check.mts` ok, `pnpm build` ok, lint 10 errors (baseline 11), `node src/lib/i18n.check.mts` ok, `e2e/new-task-modal.mjs` passed twice on :3207 (BASE=http://localhost:3207). The ticked items were proven by that e2e run; the rest need a human._

**Decisions**
- Fork (a): `claude -p` was checked first with a stub stdio MCP server whose tool returned an `image` content block; the model named the image's colour, so tool results with images reach it. New MCP tool `vibedoc_get_attachment { path }` (48 tools; HLD, DOMAIN_MAP, README, PRODUCT updated) answers with the image itself.
- Create posts multipart (`task` JSON + `image` files) only when images are attached; images are checked by their bytes (PNG/JPEG/WebP/GIF, ≤ 5 MB, never SVG) before anything is written, saved under `plans/tasks/assets/<id>/<n>.<ext>` and linked under the description.
- Start with agent uploads the images first to `plans/tasks/assets/draft-<stamp>/` (`POST /api/tasks/attachments`) and the prompt names them; the agent's task keeps linking that folder (moving it to `assets/<id>/` on Accept is a follow-up). The chat opens (new `open` option on `askAgent`).
- The draft is kept in memory until the modal opens again; a full page reload loses it (no localStorage by rule).
- Relative `![]()` images load through `GET /api/files/image?path=` in /docs and the board panel. Test review renders the evidence doc, not the task body, so it shows no task images.
- /impeccable was not named by the task, so it wasn't run.

### Steps
- [x] S9 — WHEN the user opens New Task, picks an epic and dependencies, pastes a screenshot and creates → THEN the task is linked to the epic with the image visible in its body (e2e: keyboard only, `n` → epic R002, T001 + T002, size M, P1, attached PNG, ⌘↵ → Phase/Depends on/Size/Priority lines, epic **Tasks:**, assets/T003/1.png shown in the board panel and /docs)
- [ ] S9 — WHEN the user clicks Start with agent on a rough draft → THEN a chat opens with the draft and ends with a task proposal to accept (e2e proved it with a stubbed chat; check once with the real agent: it should look at the image with vibedoc_get_attachment, ask what's missing, then propose)
- [ ] Paste a screenshot with ⌘V into the description, and drag an image file onto it → a thumbnail appears each time (the e2e uses the Attach image button)
- [x] Attach a 10 MB file and an SVG → each is refused with a clear message; `/api/files/image?path=../x.png` is refused (e2e)
- [ ] Open New Task in the light theme → the toggles, chips and thumbnails read well
- [ ] Run `vibedoc --demo`, attach an image → "Images can't be attached in the demo"; Start with agent → the demo toast
- [x] Vietnamese labels at 390px, no horizontal scroll (e2e)
### Regression risk
- [x] Creating a plain task with only a title still works (e2e)
- [ ] Breakdown plans accepted in the chat still create tasks with the right Phase and dependencies (createTask now also takes priority and images)
