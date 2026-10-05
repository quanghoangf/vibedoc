---
name: VibeDoc
description: Local-first project intelligence for AI-assisted development.
colors:
  lab-violet: "rgb(124 106 247)"
  reagent-teal: "#4fd8b4"
  burner-amber: "#f7a26a"
  signal-red: "#f76a6a"
  ink-black: "rgb(10 10 15)"
  carbon: "rgb(17 17 24)"
  graphite: "rgb(22 22 31)"
  rule-line: "rgb(34 34 46)"
  rule-line-strong: "rgb(45 45 61)"
  page-white-text: "rgb(232 232 240)"
  pencil-grey: "rgb(140 140 160)"
  accent-ink: "rgb(10 10 15)"
  paper: "rgb(255 255 255)"
  paper-tint: "rgb(248 248 252)"
  paper-tint-deep: "rgb(240 240 248)"
  paper-rule: "rgb(224 224 238)"
  paper-rule-strong: "rgb(208 208 228)"
  paper-ink: "rgb(26 26 46)"
  paper-pencil: "rgb(107 107 128)"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
  label-caps:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  hairline: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  header: "48px"
  sidebar: "16rem"
components:
  button-primary:
    backgroundColor: "{colors.lab-violet}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.page-white-text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.page-white-text}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.page-white-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  search-trigger:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.pencil-grey}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
    width: "192px"
  task-card:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.page-white-text}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  status-chip:
    textColor: "{colors.burner-amber}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  app-header:
    backgroundColor: "{colors.carbon}"
    height: "48px"
    padding: "0 16px"
  agent-status:
    textColor: "{colors.pencil-grey}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 6px"
    height: "32px"
---

# Design System: VibeDoc

## Overview

**Creative North Star: "The Lab Notebook"**

VibeDoc is a notebook kept beside the bench, not a dashboard bolted onto it. Every screen renders plain files: tasks, docs, roadmap items, chat logs. The design makes those files legible without pretending they're something else. IDs are set in mono like entry numbers. Surfaces are ruled with 1px lines rather than floated on shadows. Colour is used the way a careful experimenter uses a highlighter: sparingly, and only to mark state.

The notebook is dark by default (indigo-black ink on carbon pages), dense, and small-set. Body copy sits around 13–14px, metadata at 10–11px mono, and a whole working day of tasks fits on one board. Density is earned by rhythm, not crammed. Every row keeps the same small gaps, and nothing grows larger than its content needs. Controls are tactile and quick. Hover, focus and drag all answer within 120–180ms, and the keyboard reaches everything (⌘K, `c`, Enter on a card).

The user can re-tint the notebook without changing its structure. Settings → Appearance swaps the accent (violet default, purple, green, orange), the sans/mono pairing, the base size (13/14/16px root) and light/dark. The system must hold up under every combination, which is why every colour flows through tokens.

**Key Characteristics:**
- Dark, indigo-tinted neutrals; light theme is a first-class mirror.
- One accent (Lab Violet) for selection, focus and links; four status hues for task state, and nothing else.
- Mono for identifiers and metadata (`T055`, `R043`, `3/5`, `⌘K`), sans for everything a person reads.
- Flat, ruled surfaces. Depth comes from tone steps and hairlines; shadows only float or signal.
- Fast, soft motion (`cubic-bezier(0.22, 1, 0.36, 1)`), fully disabled under reduced motion.

## Colors

A near-monochrome indigo-grey notebook with one violet highlighter and a fixed set of status inks.

### Primary
- **Lab Violet** (`lab-violet`): the only accent. Used for focus rings, the selected nav item, links, the Review status, primary buttons, markdown `h3` and blockquote rules, and the "flash" when a card updates live. Anything set on an accent fill takes **Accent Ink** (`accent-ink`, `--rgb-accent-fg` → `text-accent-fg`), near-black in both themes: white fails 4.5:1 on all four accents, the ink passes on all four. It is stored as an RGB triplet (`--rgb-accent`) so every use can take opacity (`/5`, `/15`, `/30`), and Settings can swap it for purple, green or orange.

### Secondary
- **Reagent Teal** (`reagent-teal`): Done and inline `code` in prose. It means "settled / healthy". Light mode swaps in a darker ink (15 118 96) that clears 4.5:1 on paper and paper-tint-deep (5.55 / 4.90); the dark value was 1.78:1 on white.

### Tertiary
- **Burner Amber** (`burner-amber`): In progress, "changes requested", and warning or at-risk markers. It means "active, watch this". Light mode swaps in a darker ink (170 80 10) that clears 4.5:1 on paper and paper-tint-deep.
- **Signal Red** (`signal-red`): Blocked, destructive actions and errors. It means "stopped". Light mode swaps in a darker ink (185 28 28), and text on a filled red button or badge turns white there (6.47:1); dark keeps Ink Black on red.

### Neutral
- **Ink Black** (`ink-black`): the dark page background, inputs and outline-button fills.
- **Carbon** (`carbon`): the first surface (cards, sidebar, header at 80% with backdrop blur).
- **Graphite** (`graphite`): the second surface (hover fills, secondary buttons, inline code, size pills).
- **Rule Line** (`rule-line`) / **Rule Line Strong** (`rule-line-strong`): the default border and the hover/emphasis border. These are the notebook's ruling.
- **Page-White Text** (`page-white-text`): primary text. Prose body is mixed 55% toward Pencil Grey for a softer read.
- **Pencil Grey** (`pencil-grey`): muted text, metadata, placeholders, todo/cancelled status. Lifted to 140 140 160 on dark so it clears 4.5:1 on every dark surface; light keeps `paper-pencil` (107 107 128).
- **Light theme:** `paper`, `paper-tint`, `paper-tint-deep`, `paper-rule`, `paper-rule-strong`, `paper-ink` and `paper-pencil` fill the same seven roles.

### Named Rules
**The Highlighter Rule.** Colour marks state, never decoration. If a hue on screen doesn't mean *selected, live, done, active, blocked* or *review*, it shouldn't be there. The shell goes further: it only colours what you can act on now. An errored chat raises red for 24 hours or until dismissed, the Manual tests count stays Pencil Grey, and "all is well" is a small Pencil Grey connection dot, not a colour.

**The One Status Language Rule.** Task status has exactly one look everywhere: the `STATUS_META` icon + hue (Circle/muted, CircleDot/amber, Eye/violet, CircleSlash/red, CircleCheck/teal, CircleX/muted). The task files keep their emoji; the UI never shows them.

**The Triplet Rule.** Theme and accent colours are defined as RGB triplets on `:root` / `.dark` / `html[data-accent]`, and consumed only through Tailwind tokens (`bg-accent/20`, `border-border2`). Never hard-code a hex in a component.

## Typography

**Display Font:** Geist (with system-ui). Swappable to Inter, IBM Plex Sans, Atkinson Hyperlegible, DM Sans or system.
**Body Font:** Geist (same family, all roles).
**Label/Mono Font:** Geist Mono (with ui-monospace). Swappable to JetBrains Mono, IBM Plex Mono, DM Mono or system.

**Character:** A neutral grotesk for reading paired with a mono for anything that is an identifier. It reads as an engineer's notebook: labels you could grep for, sitting next to prose you'd want to read.

### Hierarchy
- **Display** (600, 1.6rem, -0.02em): the doc `h1` only. VibeDoc has no hero type.
- **Headline** (600, 1.1rem): doc `h2`, tinted 75% toward the accent, with a hairline underline.
- **Title** (500, 13px, snug): card titles, list rows and panel headings; 2-line clamp on cards.
- **Body** (400, 0.875rem, 1.7): prose paragraphs and list items. UI body text is `text-sm` / 13px at tighter leading.
- **Label** (mono 400, 11px): task/epic IDs, due dates, counts, keyboard hints.
- **Label Caps** (mono 500, 10px, 0.06em, uppercase): table headers and section labels.

Sizes are rem-based and follow the user's root size (13/14/16px). Arbitrary pixel sizes (`text-[10px]`, `text-[11px]`, `text-[13px]`) are the established small-type steps. Use those rather than inventing new ones.

### Named Rules
**The Grep Rule.** If a string is an ID, a path, a count, a date or a shortcut, set it in mono. If a person reads it as language, set it in sans.

## Layout

App shell: a collapsible left sidebar (16rem, 3rem icon rail, 18rem sheet on mobile), a sticky 48px header (project / page breadcrumb on the left; agent status strip, ⌘K search, Connect and Chats on the right), and a full-bleed content area. Pages own their own layout: board columns, a docs list + editor + outline, the roadmap canvas, and chat list · conversation · context rail.

Spacing runs on Tailwind's 4px grid, with the dense steps doing most of the work: 4px, 6px, 8px, 10px and 12px inside components, and 16px at page gutters (12px under `sm`). Cards pad 10px × 12px, and rows gap 6px. The header collapses secondary labels (`hidden sm:inline`) instead of wrapping.

## Elevation & Depth

Flat by default, with tonal layering. Depth reads as Ink Black → Carbon → Graphite plus 1px rules. Hover raises a surface one tone step and strengthens its border rather than lifting it. Shadows appear in only two cases: floating layers (dialogs, sheets, dropdowns, the command palette) and state signals rendered as coloured glows.

### Shadow Vocabulary
- **Float** (`shadow-lg` / `shadow-xl`, with `shadow-black/20` on dark): dialogs, sheets, menus and the palette.
- **Focus halo** (`0 0 0 3px rgb(var(--rgb-accent) / 0.15)`): keyboard focus on cards and custom controls, paired with an accent/60 border.
- **Update flash** (`flash` keyframe, 3px accent ring fading over 1.2s): a card or row that just changed via SSE.
- **Selected edge** (`inset 2px 0 0 var(--color-accent-edge)`): the active item in a vertical list, and the keyboard-focused item in a dropdown menu (over the Graphite fill, which alone is 1.05:1). `accent-edge` is the accent, except green and orange in light, which miss 3:1 on Graphite (2.01 / 2.47) and take a darker ink (4.42 / 4.57); every accent × theme clears 3:1.

### Named Rules
**The Flat-At-Rest Rule.** Nothing on the page casts a shadow unless it floats above the page or is reporting a state change right now.

## Shapes

Gently rounded, never pill-shaped except for dots and avatars. Cards and panels use 8px (`rounded-lg`). Buttons, inputs and the search trigger use 6px (`rounded-md`). Chips, pills and `kbd` hints use 4px (`rounded-sm`). Fully round shapes are reserved for status dots, the live indicator and progress counters. Borders are always 1px in Rule Line; emphasis changes the border's tone, not its width. Scrollbars are 4px hairlines with 2px ends.

## Components

### Buttons
Tactile and quick: colour shifts in 120ms, a focus ring on keyboard only.
- **Shape:** gently curved (6px); 40px default, 36px small, 44px large, 40px square icon.
- **Primary:** Lab Violet fill, Accent Ink 14px/500 text, 90% opacity on hover.
- **Outline:** Ink Black fill, 1px Rule Line border, Graphite on hover.
- **Ghost:** transparent; Graphite fill on hover. This is the default for toolbar and header actions, usually icon-only in Pencil Grey that brightens to text on hover.
- **Destructive:** Signal Red fill, white text.
- **Focus:** 2px accent ring with a 2px offset in the background colour. Disabled is 50% opacity with no pointer events.

### Chips
- **Status chip:** icon + label, 11px, 4px radius, 1px border in the status hue at 30% over a 5% tint of the same hue (e.g. amber/30 on amber/5).
- **Metadata chips:** mono 10px (size `M`, `🧪 3/5` manual tests, "changes requested"). Neutral chips use a Rule Line border or a Graphite fill; once complete they take the teal status treatment.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Carbon; on hover, Graphite at 50% with a Rule Line Strong border.
- **Shadow Strategy:** none at rest (see Flat-At-Rest). Focus uses the accent halo.
- **Border:** 1px Rule Line.
- **Internal Padding:** 10px × 12px.

### Inputs / Fields
- **Style:** Ink Black fill, 1px Rule Line border, 6px radius, 40px height, Pencil Grey placeholder.
- **Focus:** the same 2px accent ring + offset as buttons.
- **Disabled:** 50% opacity, not-allowed cursor.

### Navigation
- **Header:** 48px, Carbon at 80% with backdrop blur, sticky, hairline bottom border. It holds the breadcrumb (project switcher / page title, `/` separator in Pencil Grey at 60%). Status leads the right side: the agent status strip, then search, Connect and the Chats button (`c`), a small outline button with a speech-bubble icon and the word "Chats" from `sm` up. Connect is a menu: copy the endpoint, copy the wrapping `claude mcp add …` command (the menu stays open so the tick shows) and a Settings → MCP link, all reachable with the arrow keys; below `md` the button is icon-only.
- **Agent status strip:** a 32px ghost button (`#agent-status`, with its own skip link) in mono 11px reading `● 2 agents working · 1 running · 1 need you · 1 error`; zero counts drop out and nothing separates the dot from the first count. Agents lead: terminal Claude Code / MCP sessions from the activity log get a Bot glyph in accent that pulses only when motion is allowed, and their count in Paper White. In-app chats follow. "Agents" means terminal sessions only; in-app conversations are always "Chats". Errors count only chats that failed in the last 24h and weren't dismissed. The connection is a small neutral dot: Pencil Grey while connected ("Connected" for screen readers, briefly Paper White when an update arrives), a hollow ring while connecting, amber with "Reconnecting…" when down; the word "live" is never shown. Need-you (amber dot) and error (red dot) counts read in Paper White because you can act on them; running stays Pencil Grey behind an accent spinner. Below `sm` it collapses to the dot, "2 agents" and the need-you and error counts, with the words kept for screen readers. Click opens the head of the attention queue, otherwise `/chat`.
- **Attention queue:** one queue for the whole shell: chats that need you, then actionable errors (under 24h, not dismissed). `c`, the Chats button, a click on the status strip and ⌘K's top rows all open its head; pressing `c` again while the modal shows a queued chat moves to the next one, and past the end closes the modal. An empty queue falls back to the running chat, then the newest. The tab title's `(n)` counts the whole queue.
- **Sidebar:** Carbon, Link-based items, agents first. The logo is a flat Lab Violet tile with an Accent Ink hexagon (no gradient). The "Chats" section sits at the top and orders chats by *needs you → errors → running → recent* (errored rows are always listed; only recent rows are capped at 4); an errored row offers Dismiss while its error is still actionable, and a stale error reads as idle. The `/chat` page adds the same "Errors" section. Pages follow in two labelled groups, "Plan & supervise" (Board, Roadmap, Manual tests, Activity) and "Reference" (Docs, Memory, Explorer); Shortcuts (`?`) and Settings live in the footer. Each link, the Chats links and Settings included, shows its key in a mono 10px `kbd` on hover or focus. The `?` help sheet sets keys the same neutral way: Paper White on Graphite with a 1px rule, never accent. The active item gets a Graphite fill and accent text or edge.
- **Search trigger:** 32px, 192px wide on `sm+`, Ink Black at 60%, with a mono `⌘K` hint. It collapses to an icon on mobile.

### Task Card (signature)
A notebook entry, and the unit the whole product revolves around. The top row is mono 11px Pencil Grey: ID, agent dot, a spacer, the due date (MM-DD) and a size pill. Below it sits the 13px/500 title, clamped to 2 lines (muted once done). The footer holds the epic (mono ID + truncated title) and optional amber "changes requested" and 🧪 manual-test chips. The column already names the status, so the card never repeats it. It is draggable (50% opacity while dragging), opens on click or Enter, and animates between columns with View Transitions.

### Agent Marks (signature)
Small status dots (`AgentDot`) / marks (`AgentMark`) attached to any task, epic or roadmap node that has a chat. Both render `StatusMarker`, where each state differs in shape or motion, not only colour: running is a spinner, needs-you a pulsing amber dot, review a pulsing accent diamond, error a solid red dot, idle a hollow dot. Every marker carries `role="img"` and a label. They link straight to that chat.

### Manual Test Report (signature)
The `/manual-tests` page is **Test review**: a replay list and a player, PostHog-style. The 1.6rem title sits beside one 1.1rem semibold sentence of project-wide counts: failing (mono count, Signal Red) · in review · "N tasks need you", then a muted 13px "· N checks left" (only checks on tasks that need you); "Nothing needs you" with a teal check icon when the list is clear. Tabs underline in Lab Violet: **Needs you** (default; the one triage rule `needsYou()` in `src/lib/test-review.ts`, also the sidebar badge: the last run failed, or the task waits in review, or checks are left on a task that isn't done or cancelled) · Failed · Passed · No run · All, each with a mono count (Failed's on a red tint); on phones the strip scrolls and fades at a hidden edge. Epic select + search (`/`) sit right of the tabs. An empty Needs you says why and offers **Show all N tasks**. Left, a dense list (one 52px row per task; phones stack title over epic · manual · last run): a result glyph (red ✕ / teal ✓ on a 15% tint disc, hollow Rule Line Strong circle for no run), mono ID + title over the epic, a `review` tag and a lucide Bot icon with the automated count when present, the manual ruling (one 4px mark per item, teal once ticked) with a mono `done/total`, and the last run's `passed/steps` + time. Failing sort first, then in review, then newest. The selected row is Graphite with an inset accent hairline and a semibold title; the list is one roving tab stop. Right, the task: breadcrumb (epic links to the roadmap; Back below 1024px, where the list and the detail swap), the title at 1.1rem, status chip, **Open task ↗**, the spec path and a mono kbd strip of the keys that apply. Then the evidence: run status badge, a sticky stage (the video on a flat black panel, at most 38svh, 26svh on viewports under 760px tall so the decision bar still leaves room; no native controls) over our own timeline: play/pause, the step track as the only scrubber (a `role=slider`: click/drag seeks, ←/→ step, one segment per step clamped to the video's length, teal, Signal Red for the failed one with a red tick at the failure frame, playhead in Paper White) and mono elapsed / total (`m:ss.s` under 10s). A failed run opens paused on the failed step's frame. Then the failed step's error on a red tint, and the step list (✓/✗, `01`, name, start time, and the thumbnail as its own button that shows the still; a row click seeks to that step's moment, or shows the screenshot for runs without timing). Below, the checklist: Automated (a teal Bot icon once a passed run proves it), Manual steps with sequence numbers, Regression risk in amber. Step text keeps the action → expected split and the Grep mono rule; checkboxes stay the drawn 16px boxes. Last, the **decision bar**, sticky at the bottom of the detail (Carbon, top hairline, soft upward shadow) when the last run failed or the task is in review: the prompt ("Last run failed at step N · name" in Signal Red, or "Waiting for your review") over what is outstanding, then Approve (in review only) and Send back. Send back works from review or done (`REVIEWABLE` in `src/lib/review.ts`: a failed run reopens finished work) and pre-fills the note from the failed step; a failed run on a task the agent still holds only links to it. After a decision the next row that needs you is selected. Keys (`TEST_REVIEW_KEYS`, also the `?` sheet's Test review section): `j`/`k` walk from anywhere (↓/↑ only with focus in the list, so elsewhere they scroll), `x` ticks the next manual check, `f` next failed, `s` opens Send back, `a` focuses Approve and a second `a` (or Enter) approves, so one stray key never finishes a task; space plays with the player focused. A focused checklist box keeps these keys on this page only. No emoji anywhere. The detail's top-right has two 32px icon buttons: Open as page / Collapse (`o`, `?full=1`: the list and filters fold away and the task centres at max 64rem) and Close (`Esc`, `?panel=0`: the list takes the full width until a row is picked). Motion is transform + opacity only: the panel slides in 24px from the right (260ms ease-out-soft) and back out before the URL changes, Open as page glides the task in from the right, and the list slides back in from the left when it reappears. Multi-select: a 16px checkbox replaces a row's result glyph on hover (and on every row once anything is picked; ⇧-click = range, ⌘/Ctrl-click = toggle, header box = all / mixed); picked rows tint Lab Violet at 8%. A bar docks at the bottom of the list (Surface, soft drop shadow): `N selected` · Tick all · Untick all (manual items only, 🤖 untouched, Undo flips back exactly what changed) · Approve N (in review) · Send back N… (one note for all, review or done) · ✕. Esc clears the selection before it closes the panel. Under the header a two-segment control (a `role=group` of `aria-pressed` buttons: Review · Evidence, `v`, `?view=evidence`) swaps the run player + checklist for the **evidence doc** (R060): the doc's head first (the verdict, linking to the failed step's group, the coverage line, then the run line with its time in local time like History; the doc itself keeps UTC), then a compact History list of kept runs (status dot, mono 11px relative time and local date-time (hidden on phones), mono short commit; one line per run, newest first, the shown one on Graphite; a pick sets `?run=`; `[` / `]` step to the older / newer run, shown in the kbd strip only with 2+ runs, and a polite live region announces "Showing run from 05:07, failed"; an older run gets an "Older run · newest … Show newest →" line, a pruned `?run=` keeps History and offers Show newest run), then the rest of the doc through the prose renderer's `prose-evidence` variant (its H1 hidden, its `## History` table dropped for the list above, which shows even for one run and is an h2 like the doc's sections; no list bullets, headings in text colour, inline code in Pencil Grey wrapping as whole chips, links in `accent-edge`; screenshots are buttons labelled with their step that open large: a passed step's as RunPlayer's 72px thumbnail, a failed step's full width (at most 50svh) with a red-tinted hairline; logs over 6 lines clamp with a fade and a **Show full log (N lines)** toggle; the newest run's video link reads "▶ Play this run in Review" and switches to the player, an older run's reads "Open video (.webm) ↗" in a new tab). The doc is the same markdown as the fixture's `EVIDENCE.md`, so its result glyphs (✅ ❌ ⚠️ ☐ ☑) are the one place emoji appear on this page. **Run tests** (R061, `p`; only when the task has a spec): a small Lab Violet-tinted button beside Open task, Stop in Signal Red while this task runs, disabled with "T0xx is running" while another task in the project runs (one run per project). During a run a live strip replaces the player: a spinner headline ("Starting the app…", "Running · step N"), then one row per step (spinner / teal check / red cross, mono `01`, the step text, its own mono clock, the error with Expected / Received under a failed step); the Automated items mirror it live ("· running now" in accent), so the checklist ticks as steps pass. When it ends the strip keeps the verdict (Passed · N/N steps · total time, Failed at step N, Stopped, or Couldn’t run the spec with the last 20 output lines in a mono box) above the reloaded player until ✕. **Review on the proof** (R062): a task in review opens on Evidence (`?view=review` to switch back), with the decision on top instead of the bottom bar: "Waiting for your review" + an amber count ("1 flagged · 1 failed"), the run it reviews (newest / older, with an amber note for an older one), Approve / Send back…, then every automated step of that run in a list: result icon, a 64px thumbnail (opens large), the step text, and a small **Doubt** chip on passed steps (Burner Amber when on, with a one-line comment field, an amber left rule and a warning icon). Failed steps are flagged with a red rule and can't be cleared. Send back lists the flagged steps with thumbnails above the note (which may then stay empty); Approve with doubts asks "Approve with N doubts?" inline. Marks live in the page only until a decision, keyed on task + run. **Unverified** (R063) is quieter than a doubt: a dashed Burner Amber outline chip "unverified" (reason in its title), a help-circle icon and a dashed amber left rule, with the reason in small amber text under the step ("Unverified: only trivial assertions. It passed but proves nothing about the app; check it by hand."). Such steps get no Doubt chip and are flagged in Send back (❔) like failed ones; the Automated header reads "· N unverified, check by hand" and the unproven items carry the chip. The Run strip says "Checking the test is honest…" during the blank-page pass and "Passed · N/N steps · M unverified" after it. **Suite** (R064) is the last tab (`?tab=suite`, mono count of done-task specs): a "Regression suite" header with the spec count and "N done tasks without a spec", and **Run suite** / Stop (`u`) on the right, disabled with "T0xx is running" while a single Run goes (single Run buttons say "The suite is running" in turn). While it runs, one compact row per task (status icon, mono id, title, `passed/steps`) under "Running · 7/12 tasks". When it ends: "Failed · 2 of 12 tasks broke" in Signal Red (or "Passed · 12/12 tasks"), the broken tasks first as red-tinted cards (the failing step's screenshot, mono id + title, "Step N" + name, the error lines in mono red, Open evidence ↗), then "N passed" folded in a details row, and the ids not reached after a Stop. **Flaky** (R065) is Burner Amber, never Signal Red: a solid amber "flaky" chip (amber 10% fill, amber border) on a step that passed only on a retry, an amber check in the Run strip ("retrying" in muted while the retry runs), "· N flaky" after Passed, a collapsible "First attempt failed (passed on attempt N)" with that attempt's error and thumbnail, an amber Flaky tab count, and amber card chips (`1/1 · 1 flaky`). Flaky passes stay under Passed and never count as broken or toward Needs you.

### Activity Timeline
`/activity` shares the Manual tests page frame: centred `max-w-4xl`, a 1.6rem title, then the last 24h as a headline ("5 tasks done · 1 ADR logged · 4 sessions in the last 24h", counts in mono, zero counts dropped, "Quiet for the last 24 hours" when empty). There is no stat-tile box and no "live" word; the shell's status strip owns the connection. Days are sticky 13px semibold headings with a hairline running out to the right. Both views sit on one clock gutter (mono `HH:MM`, 2.75rem) plus a 1.5rem marker column. Sessions with work are flat Carbon cards (hover strengthens the border and never lifts). Each card shows a Bot/User glyph, a 15px semibold headline, one 4px mark per task in that task's status hue, and chips that carry the `StatusIcon` plus ID. A session that only connected reads "Connected, nothing changed" on one muted line. "All events" is one dense line per event: clock, the type's lucide icon (a task move shows its new status icon), title, muted detail. Only human events get a "you" tag, because agents write nearly everything. No emoji anywhere.

### Board Views
`/board` is one shell over four lenses on the same task files: Board, Table, By epic and Timeline, plus saved custom views. The header matches Manual tests (1.6rem title, 1.1rem semibold summary "3 open · 1 in progress · 60 done" with mono counts, done muted) but runs full width (`px-4 sm:px-8`), with the accent "New task" button and its `n` kbd. Under it: the **views bar** (flat 13px tabs, 2px accent underline on the active one, `aria-current="page"`; built-ins first with their lucide icon, saved views with a bookmark icon and a chevron menu for Rename / Delete; `v` next view, `1`–`4` the built-ins), then the **toolbar** (search `#board-search`, focused by `/`; Filter `f`, Sort, Group, Properties). Filter and Sort are flat popovers of rule rows ("Show tasks where status is not Done"); they take focus on open, and Esc closes them and returns focus to the trigger. Active rules show as a mono count on the button. When the state differs from the saved view, the toolbar shows "Unsaved changes" with Reset, "Save as new view" and "Save view".
- **Board:** the five status columns. Done collapses to a 140px rail of the newest IDs. Swimlanes by epic or size, and fully done lanes fold away.
- **Table:** one dense row per task. Click a header to sort, Shift-click to add a sort. Groups are collapsible `<tbody>`s with 4px status marks and a done/total count.
- **By epic:** epics as sections with tasks nested under their first in-epic dependency, plus an "Up next" rail of ready tasks.
- **Timeline:** one lane per epic, with bars from the first move to in-progress up to done (or now). The default **Active time** scale folds idle gaps out of the axis, so a week of agent bursts reads as work, not white space. Day and Week show real time. Tasks that have not started sit as planned chips after the lane's last bar.
Persistence: the live view state lives in the URL (`v` = saved view id, then `view g sg s f q p sc`, defaults left out), so a link reproduces the view. Saved views live in `.vibedoc/views.json`, via `GET/POST /api/views`. There is no `localStorage`.

### Doc Link Graph
`/graph` maps every link between the project's `.md` files; `/docs` shows one file's links in the **Linked docs** column (an 18rem column from `xl`, a sheet below it, opened by the mono link-count button) and a hover/focus **preview card**. Links are derived from text, never stored. With no doc open, /docs counts in the graph's words: "197 files · 31 docs" (docs = the graph's Docs kind, not tasks, epics, entries or ADRs).
- **Shapes name the kind, never colour:** doc = circle, ADR = square, epic = diamond, task = small circle (70%), entry = ring, capability spec = hexagon. Size grows with degree. Kind chips and the legend draw the same shapes.
- **Colour marks what needs you:** tasks and epics with an active status take that status's own colour (`STATUS_COLOR_CLASS[def.color]`, the same as the board and `StatusChip`, so custom and recoloured statuses match); done and cancelled ones (custom statuses in those categories too) draw the same shape hollow in Pencil Grey, so a map of finished work stays quiet and the few in-progress / blocked / review dots carry the hue. Todo, docs, ADRs and entries stay filled Pencil Grey. The legend lists the statuses on screen as the map draws them, plus "hollow = done". Edges are Pencil Grey mixed 80% into the page so they clear 3:1 in both themes.
- **Recent:** a file an agent or a human changed in the last 24h (activity log: task moves and edits, epic / entry / ADR saves, doc edits, creates and renames, the handoff) carries a small accent notch on the dot's shoulder, never a fill. The "Recent N" chip (`?recent=1`) dims everything else, turns on the kinds the changed files belong to and frames them (a user action, so the camera moves; turning it off doesn't). A kind chip with no files is hidden. The live ping still marks a change as it happens.
- **Accent = selection, independent of hue:** the selected node gets a double ring (accent ring, a bg gap, an outer hairline in text colour), so it reads even when the accent is close to a status hue; search matches get a dashed accent ring; keyboard focus the accent halo. The selected node's edges turn `--color-accent-edge` (the accent, darkened where it would miss 3:1 on the light page: green 5.0:1 on white). Everything outside the lit set dims to 25% (nodes) / 15% (edges). Focus 1 / 2 cuts the canvas to that neighbourhood (titled "Show files within 1 / 2 links"; every card control ≥ 24px).
- **Counts are what's drawn:** the selected card (top right; on phones a bottom sheet beside the zoom controls and above the Unlinked shelf, so the map's top stays clear) counts unique visible files ("Links to 6 · Linked from 1 · +17 hidden by filters"); a hidden selection says so with a Show action instead of vanishing. Load failure is an error card with Retry, never the empty state.
- **Broken vs stale:** a broken link (md / wiki link to no file) is a dashed muted underline; a stale path (backticked path to a missing file) is a dotted underline in muted text (never the code teal) with "File not found". Panel rows match: broken rows dashed, never struck through. The panel's Broken / Stale paths sections and the MCP footer list both; the /graph toolbar shows broken only ("N broken links", "N broken" below `lg`, hidden at 0: grouped by file, most first, the first 5 files open, "Show all N files"), because a stale path is a per-doc lint, not a map concern. Each row opens the file scrolled to that line. Neither list cries wolf: template placeholders (`<slug>`, `T<NNN>`, `YYYY`, globs), syntax-teaching names (the whole name `path.md` / `[[name]]`, or after an id `T001-x.md`; never user-name.md), files that exist in dot folders and backticked bare names that exist elsewhere are never reported.
- **Motion thesis — a living map that keeps your place.** Motion is physics, but the layout stays deterministic and nothing is saved. On load and Fit (never on a live refresh) the canvas appears on its final camera and every dot unfolds from near the centre to its layout point (900ms, cubic-bezier(0.16, 1, 0.3, 1)), the best-linked file's neighbourhood first (30ms per hop, capped at 240ms); edges fade in as the dots land. It's CSS on the compositor (`graph-node-unfold`, `graph-edge-in`), never a React render per frame: every dot and edge carries its offset and delay for good (inert at rest), and one `data-unfold` attribute on the wrapper runs them (`a` / `b` alternate, so Fit restarts it) and comes off when it ends, so neither the start nor the end re-renders the map (no task over 50ms on the 197-file / 687-edge all-kinds view). A dragged dot pulls its neighbourhood along on springs, and on release everything springs home. The selected file's edges are one solid accent line, no travelling glow. Hover or keyboard focus leans linked dots in and brightens their edges, neutral not accent; hover yields to focus (while a dot holds the focus halo, the pointer doesn't move the lean, so one file is highlighted, not two). A live update sends two accent rings out of the nodes it touched; the camera never moves. A filter / focus / link change glides dots and camera together (420ms ease-out-quart); selection ripples (depth 2 lights 60ms after depth 1); labels fade (never snap) across the readable-zoom threshold and on collisions. Reduced motion: no entrance, glide, springs or lean (a dragged dot snaps back), one still ring for 1s.
- **Readable at the fitted zoom:** a label shows only while it renders ≥ 9px (zoom × 11px ≥ 9); below that only the selected file, search matches and the lit neighbourhood (and a keyboard-focused file) keep theirs, scaled back up to 9px on a `bg-surface` chip. With nothing selected or searched the map is never unlabeled: the top 10 files (Recent: the changed ones first, then by degree) keep a chip, chosen through the same collision pass. When a set is lit, only its dots are obstacles. At full zoom a label carries a bg text-shadow halo, so edges don't strike through it. A label that would cover another label or another node's dot fades out, except the selected file's, which always shows, and, below the readable zoom, its direct neighbours' chips when it has at most 8 (a hub's neighbours compete instead, lit first, so chips never stack; selecting never moves the camera; at full zoom they win collisions but yield to the selection, since plain text can't overlap legibly); other matches yield on a collision so chips never stack (Enter steps to each one). Every dot has an invisible hit pad of 24 screen px (24 / zoom flow px, capped at the 48px minimum node distance so neighbours never steal clicks); the fit and search framing never zoom out past 0.5, the floor where that cap still holds.
- **Unlinked shelf:** files with no visible link are not on the map, so they never stretch the fit. They sit on a mono-labelled "UNLINKED N" row at the canvas's bottom edge (one scrolling line on phones, right-aligned and wrapping to two lines from `md`), after the map in tab order. A shelf file draws the map's shape and status colour; click / Enter selects it, again opens it; selection and matches get the accent ring, the rest dim to 25% like the map.
- **Keyboard:** `/` focuses search. It matches labels and ids; paths only when the query has `/` or `.`, or nothing else matches (so a folder word like "roadmap" doesn't light a folder). Enter there frames every match (one match: selects it and moves there), Enter again steps through them in label order with "2 of 15" in the count, Shift+Enter steps back, and focus stays in the search box. Tab walks the nodes in label order, then the shelf (edges are never tab stops), Enter or Space selects, Enter again or `O` opens, arrows move to the nearest linked file, Esc clears the search, then the selection. Every node has a name ("Task T093 Doc link model, 4 links", ", selected" on the selection). The keys are visible, not just announced: the selected-file card carries a mono kbd strip (`↵` `o` open · `←→` linked · `Esc` clear, hidden below `sm`), the search shows a `/` kbd until there's a count, and the `?` sheet has a Graph section; all three read `GRAPH_KEYS` in `src/lib/shortcuts.ts`. Every kind off shows a Show docs button; a load failure keeps the toolbar and says what to do, with the raw error on a mono details line. **Show in graph** (the doc header's graph icon and the foot of Linked docs) opens `/graph?node=<path>&focus=1` (`graphHref`).
- **Preview card:** 320px Float layer (in the Linked docs column: beside it on the left, top on the row, so it never covers sibling rows; with no room there, as in the phone sheet, no wider than the column, above the row when it fits, else below), 350ms hover delay; keyboard focus shows it at once, but tabbing through rows (a focus within 500ms of the last) waits 200ms; never on a sheet's autofocus. The scroll that brings a newly focused link into view moves the card instead of closing it. Fades and scales from 98%, Esc closes it. It shows the title, mono path, `StatusChip` + `OwnerChip`, and ~400 chars of plain text; status emoji and checkboxes are stripped.

## Do's and Don'ts

**Board motion.** Switching views runs `document.startViewTransition` (BoardTab `select`). The one underline (`view-transition-name: board-view-tab`) glides to the new tab in 260ms. The old view fades out in 120ms, and the new one settles in over 260ms with a 6px lift (`board-view-body`). Swimlanes open and close by animating grid rows 0fr↔1fr; their content stays mounted but `inert`. Timeline bars draw in from their start once, when the view opens (`animate-grow-x`, 40ms per lane, capped at 240ms). The Filter and Sort popovers zoom in from 98% out of their trigger. Reduced motion turns all of it off through the global rule, which also covers view-transition pseudo-elements.

### Do:
- **Do** route every colour through the triplet tokens (`bg-accent/15`, `text-muted`, `border-border2`) so theme, accent and light/dark all keep working.
- **Do** use `StatusIcon` / `StatusChip` / `STATUS_META` for any task status. Never draw a new one.
- **Do** set IDs, paths, counts, dates and shortcuts in mono at 10–11px.
- **Do** show hover as one tone step up plus a stronger border, and focus as the accent ring or halo.
- **Do** use the motion tokens (`--duration-fast` 120ms, `--duration-base` 180ms, `--duration-slow` 260ms, `--ease-out-soft`) and let the global reduced-motion rule turn them off.
- **Do** keep every frequent action reachable from the keyboard, and show its shortcut in a mono `kbd`.
- **Do** treat link UI as one language: mono paths and line numbers (`L42`), counts of unique files, broken = dashed muted (a broken count is muted with the Unlink icon, never red), stale = dotted muted, tasks and epics in a link list carry their `StatusIcon`, and a live change marked by the update flash (the live ping on /graph), never by moving what the user is looking at.

### Don't:
- **Don't** hard-code hex or `rgb()` values in components; the Settings accent and theme swaps depend on tokens.
- **Don't** add shadows to cards or panels at rest.
- **Don't** introduce a second accent or decorative colour. The four status hues are already the full vocabulary.
- **Don't** show the task files' status emoji in the UI.
- **Don't** add new arbitrary type sizes beyond 10/11/13px and the rem scale.
- **Don't** use CSS-in-JS or `localStorage` for theme state. Tailwind + `data-*` attributes on `<html>` only.
