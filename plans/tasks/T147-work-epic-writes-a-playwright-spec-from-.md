# T147: /work-epic writes a Playwright spec from the checklist
**Status:** ✅ Done
**Phase:** R058 — Auto-tests from the checklist
**Size:** M
**Depends on:** T145
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
When an agent finishes a UI task, it turns every checklist item that has a testable expected result into a step of a Playwright spec in the target repo, and links that spec from the task.

## Context
- Epic: `plans/roadmap/R058-auto-tests-from-the-checklist.md`
- **Blocked by R057 (Frontend app detection):** the spec relies on R057's detected app URL, start command and saved login session (storageState). Before you start, check which settings R057 actually shipped and use those names. Don't invent your own config.
- Builds on T063: `skills/work-epic/SKILL.md` already writes the `## Manual tests` report after Verify.
- Decided: one spec per task, at `<playwright testDir>/vibedoc/T<NNN>-<slug>.spec.ts` in the target repo (it falls back to `e2e/vibedoc/` when there's no config). One `test()` per task, with one `test.step('<checklist item text>')` per automated item.
- Decided: an item is automated only if its expected result (after `→`) can become a real assertion (`expect(...)` on visible text, URL, element state or count). Visual judgement, external systems and regression-risk items that would need unrelated setup stay manual.
- Only UI tasks get a spec. A task with no browser-facing change keeps an all-manual report.

## Scope
- [ ] `skills/work-epic/SKILL.md`: a "Write the spec" step after the report is drafted: decide auto vs manual per item, write the spec, mark the automated items with `🤖`, and pass `spec` in `vibedoc_update_task`
- [ ] Spec rules in the skill: role/text locators over CSS, no fixed sleeps, every step ends with an `expect`, and the login comes from R057's storageState rather than a scripted login
- [ ] A short example (checklist → spec) in the skill

**Out of scope:** running the spec and gating done (task 4), screenshots and video (R059), CI.

## Files
- `skills/work-epic/SKILL.md`
- `src/app/api/mcp/route.ts`: mention the `spec` param and the 🤖 marks in the `vibedoc_update_task` description, if task 1 didn't already

## Acceptance criteria
- [ ] `/work-epic` on a fixture epic with one UI task leaves `e2e/vibedoc/T001-*.spec.ts` in the fixture FE app, with one `test.step` per 🤖 item
- [ ] The task's report marks exactly those items with 🤖, and the header shows the spec path
- [ ] An item like "looks right" stays manual
- [ ] A non-UI task gets no spec

## Verify
```bash
npm run build && npm run lint
# Fixture FE app (from R057) + epic with one UI task → /work-epic → inspect the spec and the task's ## Manual tests
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open skills/work-epic/SKILL.md → loop step 5 points to the "Write the spec (UI tasks)" section, which sits between "Manual test report" and "Stop rules"
- [ ] Read "Write the spec" → it calls `vibedoc_get_frontend` first and skips the spec when no frontend is detected or Playwright is not installed
- [ ] Read the spec path rule → `<testDir>/vibedoc/<task file name>.spec.ts` inside the app Dir (fallback `e2e/`), and `spec` is passed relative to the repo root
- [ ] Read the example → "The light theme looks right…" and the Regression item have no 🤖, and every `test.step` ends with an `expect`
- [ ] Run `/work-epic` on a small epic with one UI task in a project with Playwright → `e2e/vibedoc/T<id>-*.spec.ts` appears, and the task card checklist shows the spec link plus 🤖 only on the steps the spec covers
- [ ] Same run with a login saved under Settings → Frontend app → the spec has `test.use({ storageState: … })` pointing at `.vibedoc/auth/storage-state.json` and no typed password (not checked by the agent: the fixture had no saved login)
### Regression risk
- [ ] A /work-epic run on a backend-only or docs task → still ends with a plain manual test report, no spec and no 🤖 marks, and the task is marked done and committed as before
