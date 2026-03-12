# ADR-004: Hand-Rolled JSON-RPC MCP (No SDK stdio)
**Status:** ✅ Accepted
**Date:** 2025-02-28

## Context
MCP (Model Context Protocol) has an official SDK. However the standard transport is stdio (stdin/stdout process). We want MCP over HTTP so AI agents connect to our running Next.js server.

## Decision
**Implement MCP JSON-RPC 2.0 directly** in `/api/mcp/route.ts`. Handle `initialize`, `tools/list`, and `tools/call` manually. No `@modelcontextprotocol/sdk` stdio transport.

## Rationale
- The MCP SDK stdio transport runs as a subprocess — incompatible with Next.js API route lifecycle
- HTTP JSON-RPC is well-specified and straightforward to implement for our small tool set (10 tools)
- Allows AI agents to connect via URL config instead of command config (`"url":` instead of `"command":`)
- Full control over request/response format
- The SDK's `McpServer` class can be used for schema validation without the stdio transport

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| SDK stdio transport | Subprocess model incompatible with Next.js; requires separate process |
| Separate Node.js MCP server alongside Next.js | Two processes, CORS, deployment complexity |
| SDK HTTP transport (experimental) | Not stable at build time |

## Consequences
- Must manually maintain the `TOOLS` array in `route.ts`
- JSON-RPC protocol details (jsonrpc: "2.0", id handling) managed manually
- Adding a new tool = add to TOOLS array + add case in handleTool() + document in TOOLS.md
- AI agent config uses `"url": "http://localhost:3000/api/mcp"` — simpler than command config
