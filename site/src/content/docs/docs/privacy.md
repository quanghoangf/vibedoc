---
title: First-run feedback & privacy
description: What VibeDoc can send, only if you say yes, and how to turn it off.
---

VibeDoc sends nothing about your project unless you say yes. On a project's first open it asks once, in a small card, whether to send **first-run feedback**: an anonymous note when you reach each setup step, so the step that loses people gets fixed first.

### What is sent

Only with your yes, once per step per project, from your browser:

| Step | Request |
|---|---|
| You opened VibeDoc | `GET https://vibedoc.goatcounter.com/count?p=%2Ffirst-run%2Fstarted&t=First%20run%3A%20started&e=true` |
| An agent connected | `GET https://vibedoc.goatcounter.com/count?p=%2Ffirst-run%2Fagent-connected&t=First%20run%3A%20agent-connected&e=true` |
| The first epic is on the roadmap | `GET https://vibedoc.goatcounter.com/count?p=%2Ffirst-run%2Ffirst-roadmap&t=First%20run%3A%20first-roadmap&e=true` |
| The first task is done | `GET https://vibedoc.goatcounter.com/count?p=%2Ffirst-run%2Ffirst-task-done&t=First%20run%3A%20first-task-done&e=true` |

These go to [GoatCounter](https://www.goatcounter.com/), the same cookie-free counter the VibeDoc site uses. The request carries the step name and nothing else: no project name, file path, file content, task or doc text, no ID and no cookie. Like any web request it reaches GoatCounter from your IP address; GoatCounter says it does not store IP addresses.

When you say yes on a project that is already set up, only "You opened VibeDoc" is sent; steps you reached before are never sent.

### Never sent

Anything else. If you say no, or never answer, VibeDoc makes no request to GoatCounter at all.

### Turn it on or off

**Settings → Privacy → First-run feedback.** The switch shows the same list of requests. Turning it on sends from the next step on; turning it off stops at once. The answer is stored per project in `.vibedoc/feedback.json`.

`VIBEDOC_FEEDBACK=0` turns the feature off completely (no card, nothing sent), for CI or shared machines. The read-only demo never asks.

### Stuck? Tell us

The Help panel (bottom right) and the card have a **Stuck? Tell us** link. It opens a new GitHub issue prefilled with your VibeDoc version, your OS family and the last setup step you reached. You read and submit it yourself; it works whether or not you said yes.

### For the maintainer

The opted-in steps show as events on the GoatCounter dashboard. `GOATCOUNTER_TOKEN=<token> node scripts/first-run-funnel.mjs --days 30` prints them as a funnel (runs per step, share of started, drop from the step before). GoatCounter counts unique visitors per day, so two first runs from one IP on one day count once.
