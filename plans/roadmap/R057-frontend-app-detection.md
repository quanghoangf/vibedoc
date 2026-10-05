# R057: Frontend app detection
**Parent:** R002
**Status:** done
**Order:** 170
**Tasks:** T138, T139, T140, T141, T142, T143, T144

VibeDoc finds the project's frontend app on its own, so auto-tests work in any repo without hand-written config.

**In scope:** detect the FE app inside VIBEDOC_ROOT (single app or monorepo package), how to start it and its URL, whether Playwright is installed (offer to add it), log in once and reuse that session for every test, a settings override when detection guesses wrong
**Out of scope:** separate FE repos and deployed-URL-only targets, mobile/native apps
**Done when:** on a fresh project with a web frontend, VibeDoc shows the detected app, start command and URL, and a smoke test can open the app's first page logged in
