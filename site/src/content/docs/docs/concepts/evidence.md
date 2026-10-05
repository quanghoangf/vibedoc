---
title: Evidence and test runs
description: Every finished task comes with a checklist, screenshots, a video and a verdict.
sidebar: { order: 5 }
---

"Done" means proven. When an agent finishes a task it writes a **test checklist** (`## Manual tests` in the task): what to click and what you should see. Items a script can check become a Playwright spec, marked 🤖, that the agent runs before it marks the task done.

- **Screenshots and video.** Specs import VibeDoc's test kit (`<testDir>/vibedoc/kit/`, written into your app and committed with the specs). Each `step()` saves a screenshot, every test records a video, and each run is kept under `~/.vibedoc/runs/` (the newest 5 per task).
- **Honest steps.** A step with no assertion on the page, or one that still passes on a blank page, is **unverified** and never counts as proven.
- **Run from VibeDoc.** **Test review** (`/manual-tests`) runs a task's spec live, or the regression suite (every done task's spec in one run). Failed tests retry; a pass after a retry is marked flaky. A done task whose spec fails goes back to the queue on its own, with the failing step attached.
- **Evidence doc.** Each task's evidence view lines up the checklist with the newest run: which items passed, which failed and at which step, and which have no proof yet. Agents read the same thing with [`vibedoc_get_evidence`](/vibedoc/docs/tools/vibedoc_get_evidence/).

Set up the app under test once in **Settings → Frontend app**: detected start command and URL, Playwright install, and a saved login session.
