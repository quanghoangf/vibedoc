# R094: API reference from OpenAPI
**Parent:** R004
**Status:** planned
**Order:** 150
**Tasks:** T500, T501, T502, T503

Projects with an OpenAPI spec get a browsable API reference next to their docs, and agents can look up one endpoint's contract. Adapted from Fern's API reference and API Explorer, local only. Check first that VibeDoc users keep a spec in the repo.

**In scope:** detect `openapi.(yaml|json)`; endpoint list + schemas in /docs; MCP `vibedoc_get_endpoint`; Try it only against the project's local app (`ensureFrontend`), no proxy
**Out of scope:** SDK generation, AsyncAPI / gRPC / GraphQL, hosted explorer
**Done when:** a project with an OpenAPI spec shows its endpoints in /docs and `vibedoc_get_endpoint` returns one endpoint's request and response shape

## Scenarios
### S1: Endpoints in /docs
- WHEN a project keeps an `openapi.yaml` / `openapi.json` (OpenAPI 3.x) and the user opens /docs
- THEN an "API reference" entry lists every endpoint (method, path, summary, grouped by tag), and opening one shows its parameters, request body and responses with their schemas
### S2: Agent looks up one endpoint
- WHEN an agent calls `vibedoc_get_endpoint` with a method and path
- THEN it gets that endpoint's parameters, request body shape and response shapes, with local `$ref`s resolved; an unknown endpoint lists the ones that exist
### S3: Try it against the local app
- WHEN the user sends a request with Try it on an endpoint
- THEN VibeDoc sends it to the project's own local app (started if needed) and shows the status and body; a target that isn't localhost is refused
### S4: No spec, nothing new
- WHEN the project has no OpenAPI spec
- THEN /docs shows no API reference entry and `vibedoc_get_endpoint` says no spec was found
