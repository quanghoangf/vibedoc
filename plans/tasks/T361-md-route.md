# T361: Each doc as markdown at /md/<path>
**Status:** ✅ Done
**Owner:** ai:claude-code
**Done:** 2026-10-07
**Phase:** R087 — Agent-ready docs
**Size:** M (2–3 hrs)
**Depends on:** T360
**Covers:** S2, S3

## Goal
An agent with only `curl` can fetch any doc as plain markdown: `GET /md/docs/x.md`, or the doc's UI URL `/docs?doc=<path>` with `Accept: text/markdown`.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- Decided: exact path resolution, not `readDoc`'s fuzzy glob (a URL that silently serves a neighbouring file is worse than a 404).
- Decided: content negotiation on the page URL via Next 16 `src/proxy.ts` (renamed from middleware), rewriting `/docs?doc=<p>` with `Accept: text/markdown` to `/md/<p>`.
- Trust boundary: `readDoc` has no containment check. The new reader must refuse `..` escapes, absolute paths, any segment starting with `.` (dot-folders), `node_modules`, and non-`.md` files.
- Only `src/lib/core.ts` touches fs.

## Scope
- [ ] `core.ts`: `readDocExact(docPath, root)` → `{path, content}` or throws; refusals as above (copy `createDoc`'s `resolvedRoot + path.sep` guard).
- [ ] `src/app/md/[...path]/route.ts`: `GET` → `forAgent(content)` as `text/markdown; charset=utf-8`; honours `?root=` via `rootFrom`; refused path → 400 text, missing → 404 text (suggestions come in T362). Next 16: `params` is a Promise.
- [ ] `src/proxy.ts` with a matcher on `/docs`: Accept contains `text/markdown` and `?doc=` set → rewrite to `/md/<doc>` (keep `root`).

**Out of scope:** similar-path suggestions (T362), `/llms.txt` (T363).

## Files
- `src/lib/core.ts`, `src/app/md/[...path]/route.ts` (new), `src/proxy.ts` (new)
- `e2e/agent-ready-docs.mjs` — new, fetch-level checks against a `makeFixture()` project (style: `e2e/first-week.mjs`)

## Acceptance criteria
- [ ] `curl /md/docs/<doc>.md?root=…` → 200 `text/markdown`, agent view (T360)
- [ ] `curl -H 'Accept: text/markdown' '/docs?doc=<path>&root=…'` → same body
- [ ] `/md/../x.md`, `/md/.vibedoc/settings.json`, a dot-folder doc → refused, never file contents
- [ ] `e2e/agent-ready-docs.mjs` covers the above

## Verify
```bash
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Manual tests
_2026-10-07 — ai · e2e: `e2e/agent-ready-docs.mjs` (passed)_
### Steps
- [x] S2 — `curl http://localhost:3333/md/<a doc path>` → the doc as `text/markdown`, agent-only notes shown, human-only blocks removed
- [x] S2 — `curl -H 'Accept: text/markdown' 'http://localhost:3333/docs?doc=<a doc path>'` → the same markdown
- [x] S3 — `curl 'http://localhost:3333/md/.vibedoc/settings.json'` and `/md/docs%2F..%2F..%2Fx.md` → `Refused …`, status 400
### Regression risk
- [ ] Open /docs?doc=<path> in the browser → the docs page still opens on that doc
