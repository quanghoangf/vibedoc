# T165: Flag a step as doubtful in the Evidence view; prefilled send back
**Status:** ✅ Done
**Phase:** R062 — Evidence-based review
**Size:** M
**Depends on:** T164
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
While reading the evidence, a reviewer can mark any step as **Doubt** with a short comment. **Send back** then opens with every failed and doubted step already listed, each with its screenshot, so the note always names the step.

## Context
- Epic: `plans/roadmap/R062-evidence-based-review.md`
- The marks model and API come from the previous task (`ReviewMark`, `formatSendBackNote`, `POST /api/tasks/review` with `runId` + `marks`).
- Interview decision: until the reviewer submits, marks live only in UI state, not in the task file. Keep them in component state keyed by `taskId + runId`. Switching task or run clears them; nothing goes to localStorage.
- Failed steps from the run are included as `kind: "failed"` automatically, and the reviewer can't remove them. Manual (non-🤖) items can't be marked.
- Visual language: DESIGN.md "Manual Test Report (signature)". Doubt uses Burner Amber, the same colour as "changes requested".

## Scope
- [ ] Each automated item in the Evidence view gets a small **Doubt** toggle (only for review-status tasks). Toggling it on opens an inline one-line comment input. A doubted item gets an amber left rule and a ⚠️ glyph.
- [ ] The action bar shows a count: "2 flagged · 1 failed".
- [ ] **Send back…** opens with a read-only list of the flagged and failed steps (name, comment, screenshot thumbnail) above the free-text note. Submitting posts `runId` + `marks`. With at least 1 mark the note may be empty.
- [ ] **Approve** with at least 1 doubt asks for confirmation ("Approve with 2 doubts?"). Approve posts `runId`.
- [ ] Keyboard: `d` toggles Doubt on the focused item, if the view has item focus. Otherwise skip it, and add nothing to `TEST_REVIEW_KEYS` that collides (keep `shortcuts.check.mts` passing).
- [ ] Phone width: the toggles and the dialog fit without sideways scroll.

**Out of scope:** keeping marks across a reload before submit, multi-reviewer, and board chips.

## Files
- `src/components/manual-tests/TestEvidence.tsx`: per-item toggles and marks state.
- The shared `ReviewActions` / send-back dialog from the first task: the marks list.
- `src/lib/shortcuts.ts` (only if `d` is added), `DESIGN.md` (the doubt mark in the signature section).

## Implementation notes
- Item ↔ step mapping and screenshot names: reuse what the Evidence view already renders from the evidence API. Don't re-derive them from the markdown.
- Reset the marks by keying the component on `taskId:runId`, not with an effect.

## Acceptance criteria
- [ ] Mark 1 step Doubt with a comment, then Send back with no note → the task is todo, and its `## Review` entry lists that step plus any failed step, with screenshots.
- [ ] A failed run: Send back lists the failed step even with no doubts.
- [ ] Approve with a doubt asks for confirmation. Approve without doubts doesn't.
- [ ] Switching to another run clears the marks.
- [ ] Lint stays at the baseline, and `pnpm build` and `node src/lib/shortcuts.check.mts` pass.

## Verify
```bash
node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
# /manual-tests?task=<review task>&view=evidence → doubt a step → Send back → git diff plans/tasks/<task>.md
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Put a task with a passing run in review (e.g. T155) and open it on /manual-tests → under the review bar, "Steps to review" lists every automated step with its icon, a thumbnail (click → large) and a Doubt chip
- [ ] Click Doubt on step 2 and type a comment → the step gets an amber rule and warning icon, the bar shows "1 flagged"
- [ ] Send back… → the flagged step (thumbnail, text, comment) is listed above the note; with an empty note Send back is enabled; sending writes `Run <id>` and `- ⚠️ Step 2 "…" — doubt: <comment> · screenshot …` into ## Review and the task goes to todo
- [ ] Approve with a doubt → "Approve with 1 doubt?" + Approve anyway / Cancel; without doubts Approve goes straight through and the entry reads `All N steps reviewed`
- [ ] A task in review whose last run failed → the failed step is red and already listed under Send back (with its error), even with no doubts (agent checked with a throwaway failing spec, since removed)
- [ ] Pick an older run in History → the doubts reset
- [ ] At phone width (~390px) the steps list, Doubt chips and comment field fit without sideways scroll
### Regression risk
- [ ] The task panel's Approve / Send back (plain note) and the Review view's decision bar still work as before
