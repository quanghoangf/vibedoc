# ADR-001: Next.js as Unified UI + API Server
**Status:** ✅ Accepted
**Date:** 2025-02-28

## Context
Need a framework for a local tool that serves a browser UI AND exposes HTTP API endpoints (for MCP over HTTP and SSE). Want minimal configuration and a single `npm run dev` command.

## Decision
Use **Next.js 14 App Router**. UI pages and API routes live in the same codebase and same process.

## Rationale
- API Routes give us `/api/mcp`, `/api/events`, `/api/tasks` etc. in the same process — no separate Express server
- SSE works natively as a `ReadableStream` response in API routes
- TypeScript + file-system access from API routes is exactly what we need
- Single `npm run dev` starts everything
- App Router with `'use client'` / server component split is clean for our pattern

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| Express + React SPA | Two processes, more config, CORS issues |
| Remix | Less familiar, similar capabilities |
| Hono + Vite | Good but less ecosystem, more setup |

## Consequences
- MCP SDK stdio transport can't be used (not compatible with Next.js API route lifecycle) → hand-rolled JSON-RPC
- Server components can't be used for the main page (need client-side SSE subscription and real-time state)
- `next build` + `next start` for production self-hosting
