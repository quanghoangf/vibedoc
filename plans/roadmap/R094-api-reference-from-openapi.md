# R094: API reference from OpenAPI
**Parent:** R004
**Status:** planned
**Order:** 150
**Tasks:** —

Projects with an OpenAPI spec get a browsable API reference next to their docs, and agents can look up one endpoint's contract. Adapted from Fern's API reference and API Explorer, local only. Check first that VibeDoc users keep a spec in the repo.

**In scope:** detect `openapi.(yaml|json)`; endpoint list + schemas in /docs; MCP `vibedoc_get_endpoint`; Try it only against the project's local app (`ensureFrontend`), no proxy
**Out of scope:** SDK generation, AsyncAPI / gRPC / GraphQL, hosted explorer
**Done when:** a project with an OpenAPI spec shows its endpoints in /docs and `vibedoc_get_endpoint` returns one endpoint's request and response shape
