# R079: Watchable evidence videos
**Parent:** R002
**Status:** planned
**Order:** 310
**Tasks:** T225, T226, T227, T228, T229, T230

A person reviewing a task on Test review can follow its run video: they see what was clicked and which step is playing, at a pace their eyes can keep up with.

**In scope:** the run player (`RunPlayer` on Test review): playback speed, pausing at the end of each step, the step name over the video (from the steps' `startMs`/`endMs`); a presentation mode in the Playwright test kit for new runs (Playwright's built-in action annotations: an animated cursor, the target highlighted, the action title, paced; a chapter card per step; a short hold after each step), on by default for a single Run from VibeDoc and for an agent's own `npx playwright test`, off for the regression suite, the blank-page check, CI and `VIBEDOC_PRESENT=0`; a frontend app on Playwright older than 1.59 records plain; overlays never show in step screenshots or affect assertions
**Out of scope:** the site's demo video (`site/scripts/record-demo.mjs`); editing or exporting videos; narration or audio
**Done when:** on Test review, an existing run's video can play at 0.5×, stops at each step's end with that step's name shown, and a new single Run records a video with a visible cursor, click marks and step captions while its screenshots and pass/fail are unchanged

## Scenarios
### S1: Slow the replay down
- WHEN a reviewer picks 0.5× on a run's video on Test review
- THEN the video plays at half speed, and after a reload the player still starts at 0.5×

### S2: Stop at each step
- WHEN the video plays with auto-pause on and reaches the end of a step
- THEN it pauses on that step's screenshot moment with the step's name shown over the video, and Play goes on to the next step

### S3: See what was clicked
- WHEN a single Run records a new video on a frontend app with Playwright 1.59 or newer
- THEN the video shows an animated cursor, the target element highlighted, the action title, a chapter card with each step's name, and a short hold after each step

### S4: Evidence stays the same
- WHEN a run records in presentation mode
- THEN its step screenshots carry no cursor, highlight or chapter, and its pass/fail, assertion counts and honesty verdict are the same as a plain run

### S5: Plain where speed matters
- WHEN the run is the regression suite, the blank-page check, CI, `VIBEDOC_PRESENT=0`, or the app's Playwright is older than 1.59
- THEN the video is recorded plain, and run.json and the player say why
