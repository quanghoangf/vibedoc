---
title: Evidence and test runs
description: Every finished task comes with a checklist, screenshots, a video and a verdict.
sidebar: { order: 5 }
---

"Done" means proven. When an agent finishes a task it writes a **test checklist** (`## Manual tests` in the task): what to click and what you should see. Items a script can check become a Playwright spec, marked 🤖, that the agent runs before it marks the task done.

- **Screenshots and video.** Specs import VibeDoc's test kit (`<testDir>/vibedoc/kit/`, written into your app and committed with the specs). Each `step()` saves a screenshot, every test records a video, and each run is kept under `~/.vibedoc/runs/` (the newest 5 per task).
- **Videos you can follow.** On Test review the run player has a speed control (0.5× to 2×), and by default it stops at the end of each step with the step's name over the video. Press Play for the next step. Both choices are remembered in your browser.
- **Presentation recording.** New runs record with Playwright's action annotations: a cursor moves to each click, the target is outlined, and the action is named. Each step opens with a chapter card (`01 · <step>`), and the result holds still for a moment. Actions are paced, so a run takes a little longer. It needs Playwright 1.59 or newer in your app. It is off for the regression suite and in CI, and `VIBEDOC_PRESENT=0` turns it off for any run. Step screenshots never show the annotations. The player says when and why a video was recorded plain. A spec that builds its page with `page.setContent` loses the annotations after that call, which is a Playwright limitation; `page.goto` is fine.
- **Honest steps.** A step with no assertion on the page, or one that still passes on a blank page, is **unverified** and never counts as proven.
- **Run from VibeDoc.** **Test review** (`/manual-tests`) runs a task's spec live, or the regression suite (every done task's spec in one run). Failed tests retry; a pass after a retry is marked flaky. A done task whose spec fails goes back to the queue on its own, with the failing step attached.
- **Evidence doc.** Each task's evidence view lines up the checklist with the newest run: which items passed, which failed and at which step, and which have no proof yet. Agents read the same thing with [`vibedoc_get_evidence`](/vibedoc/docs/tools/vibedoc_get_evidence/).

Set up the app under test once in **Settings → Frontend app**: detected start command and URL, Playwright install, and a saved login session.
