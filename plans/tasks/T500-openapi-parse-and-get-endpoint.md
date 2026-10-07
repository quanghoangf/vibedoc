# T500: OpenAPI parsing + MCP vibedoc_get_endpoint
**Status:** 📋 Todo
**Phase:** R094 — API reference from OpenAPI
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S2, S4

## Goal
An agent can ask `vibedoc_get_endpoint {method, path}` and get one endpoint's parameters, request body and response shapes from the project's OpenAPI spec, with local `$ref`s resolved. This is the thin read-only slice the /docs view (T501) and Try it (T502) build on.

## Context
- Epic: `plans/roadmap/R094-api-reference-from-openapi.md`
- Decisions from the breakdown:
  - OpenAPI 3.x only, JSON and YAML. A file whose `openapi` field isn't `3.*` is refused with a message (Swagger 2.0 is out).
  - Detection: files named `openapi.yaml`, `openapi.yml` or `openapi.json` anywhere in the project, minus `node_modules` and dot-folders; the shortest path wins, ties sorted. One spec per project for now.
  - YAML via the `yaml` package (no YAML parser is installed; it is small and well-known). JSON via `JSON.parse`.
  - Only local `$ref`s (`#/components/...`, JSON pointer with `~0`/`~1` escapes). External refs are left as `{ $ref }` and shown as `<ref> (external, not resolved)`. Cycles stop at the second visit and show the ref name.
- CLAUDE.md: "Only `src/lib/core.ts` touches the file system"; new MCP tool goes in `src/lib/mcp-tools.ts` (the site generates a page per tool from it); "Pure libs never import values from each other".

## Scope
- [ ] `pnpm add yaml`
- [ ] `src/lib/openapi.ts` (pure): `parseOpenApi(text)` → `{ spec } | { error }`; `listEndpoints(spec)` → `{ method, path, summary, operationId, tags }[]` in file order; `endpointDetail(spec, method, path)` → params (path-level + operation-level merged), request body (content type + resolved schema), responses (status → description + resolved schema); `resolveRefs(spec, node)`; `schemaShape(schema)` → compact TS-like text (`{ id: string; name?: string; tags: string[] }`, enums as `"a" | "b"`, `oneOf/anyOf` as `|`, `allOf` as `&`); `formatEndpoint(detail)` → markdown for MCP; `formatEndpointList(list)`
- [ ] `src/lib/openapi.check.mts` (assert-based, YAML + JSON inline): parse, list, path-level params merged, `$ref` resolved, cycle stops, external ref left, unknown endpoint, non-3.x refused
- [ ] core: `readOpenApi(root)` → `{ path, spec } | { path, error } | null`
- [ ] MCP `vibedoc_get_endpoint { method?, path? }` in `src/lib/mcp-tools.ts` + its case in `src/app/api/mcp/route.ts`: both given → `formatEndpoint`; missing / unknown → the endpoint list (with a "No endpoint X" line); no spec → "No OpenAPI spec found (openapi.yaml / openapi.yml / openapi.json, OpenAPI 3.x)"
- [ ] Example spec `examples/openapi/openapi.yaml` (a small "todos" API: tags, path params, query param, a `$ref`'d body, 200/404 responses, one self-referencing schema) for the e2e scripts
- [ ] Tool count 45 → 46 in `PRODUCT.md`, `README.md`, `DOMAIN_MAP.md`, `HLD.md`

**Out of scope:** the /docs view (T501), Try it (T502), external `$ref`s, multiple specs per project.

## Files
- `src/lib/openapi.ts`, `src/lib/openapi.check.mts` — new
- `src/lib/core.ts` — `readOpenApi` (follow `listSpecs` ~line 1843 for glob + read)
- `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts` — new tool (follow `vibedoc_get_spec`)
- `examples/openapi/openapi.yaml` — new
- `package.json`, `pnpm-lock.yaml`

## Implementation notes
- `openapi.ts` imports `yaml` (a package, fine for `node *.check.mts`), never another lib in `src/lib`.
- Match paths exactly as written in the spec (`/todos/{id}`); method case-insensitive.

## Acceptance criteria
- [ ] `vibedoc_get_endpoint {method: "GET", path: "/todos/{id}"}` on a project with the example spec returns parameters, and the 200 response shape with the `$ref`'d schema's fields
- [ ] Unknown endpoint → the list of endpoints; no spec → the "No OpenAPI spec found" line
- [ ] `node src/lib/openapi.check.mts` passes

## Verify
```bash
node src/lib/openapi.check.mts
pnpm lint && pnpm build
```

## Manual tests
- [ ] S2 — WHEN an agent calls `vibedoc_get_endpoint` with a method and path → THEN it gets parameters, request body and response shapes with local `$ref`s resolved; an unknown endpoint lists the ones that exist
- [ ] S4 — WHEN the project has no OpenAPI spec → THEN `vibedoc_get_endpoint` says no spec was found
