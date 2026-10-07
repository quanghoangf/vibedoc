# T502: Try it against the project's local app
**Status:** ✅ Done
**Phase:** R094 — API reference from OpenAPI
**Size:** M (2–3 hrs)
**Depends on:** T501
**Covers:** S3

## Goal
From an endpoint in the API reference the user fills path/query params and a body, presses Send, and sees the status and body the project's own local app answered.

## Context
- Epic: `plans/roadmap/R094-api-reference-from-openapi.md`
- Decisions from the breakdown:
  - Same-origin route `POST /api/openapi/try { method, path, params, query, body? }` (`refuseCrossSite` from `src/lib/same-origin.ts`). Not an open proxy: the client never sends a host.
  - Target base: the spec's first `servers[].url` when its host is local (`localhost`, `127.0.0.1`, `[::1]`); else the frontend app's URL (`detectFrontend`), started with `ensureFrontend` like `/api/frontend/server`. Any resolved target that isn't local → 400 "Try it only calls the project's local app". Pure `isLocalUrl`, `tryTarget(spec, appUrl)` and `buildTryUrl(base, path, params, query)` in `openapi.ts`.
  - The method and path must be an endpoint in the spec (no arbitrary paths). Response body capped at 1 MB, 15 s timeout, redirects not followed.
  - Demo → `demoForbidden()`, playground → `playgroundForbidden()` (it can start processes).
- CLAUDE.md: i18n en + vi; Try it changes no VibeDoc files, but starting the app emits `frontend_server_updated` like the server route.

## Scope
- [ ] `openapi.ts`: `isLocalUrl`, `tryTarget`, `buildTryUrl` (+ cases in `openapi.check.mts`: localhost/127.0.0.1/::1 ok, `example.com` / `10.0.0.1` refused, path params encoded, missing required path param error)
- [ ] `src/app/api/openapi/try/route.ts`
- [ ] `ApiReference.tsx`: Try it panel (inputs per path/query param, JSON body textarea when there is a body, Send, status + elapsed + body (pretty JSON when JSON), error message on refusal)
- [ ] i18n keys
- [ ] `e2e/api-reference.mjs`: a tiny `node:http` server on a free port as the "local app" (spec `servers: [{url: http://localhost:<port>}]` written into the fixture) → Send shows its status/body; a spec whose server is `https://api.example.com` and no frontend app → refusal shown

**Out of scope:** auth helpers / saved requests, calling hosted servers, a generic proxy.

## Files
- `src/lib/openapi.ts`, `src/lib/openapi.check.mts`
- `src/app/api/openapi/try/route.ts` — new
- `src/components/docs/ApiReference.tsx`, `src/i18n/apiRef.ts`, `e2e/api-reference.mjs`

## Acceptance criteria
- [ ] Send on `GET /todos/{id}` with a local server returns its status and body in the panel
- [ ] A non-local target is refused with a clear message; a path not in the spec is refused
- [ ] Cross-site POST → 403
- [ ] `node src/lib/openapi.check.mts` and `e2e/api-reference.mjs` pass

## Verify
```bash
node src/lib/openapi.check.mts
pnpm lint && pnpm build
PORT=3194 pnpm dev &   # then:
BASE=http://localhost:3194 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/api-reference.mjs
```

## Manual tests
- [ ] S3 — WHEN the user sends a request with Try it → THEN it goes to the project's own local app and the status and body show; a non-local target is refused
### Steps
- [x] 🤖 With the spec's server on a local stub, open GET /todos/{id}, fill `id`, Send → "200 OK", elapsed ms and the pretty JSON body
- [x] 🤖 POST /todos with body `{"title":"New"}` → "201 Created"; the app got `application/json` and that body
- [x] 🤖 Change the spec's server to `https://api.example.com` (no frontend app) → Send shows "Try it only calls the project's local app" and nothing is sent
- [ ] A project whose spec has no local server but has a frontend app (Settings → Frontend app): Send starts the app if it is down, then answers
- [ ] A spec server on localhost that isn't running → a clear "failed: ECONNREFUSED" message, no hang
### Regression risk
- [ ] Settings → Frontend app start/stop still shows the right state after Try it started the app
