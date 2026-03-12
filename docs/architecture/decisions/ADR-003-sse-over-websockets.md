# ADR-003: SSE over WebSockets for Real-Time
**Status:** ✅ Accepted
**Date:** 2025-02-28

## Context
When AI mutates a task, the browser should update without polling. Need a real-time channel from server to browser.

## Decision
Use **Server-Sent Events (SSE)** via a `ReadableStream` response at `/api/events`. In-process event bus (`src/lib/events.ts`) connects API routes to the SSE stream.

## Rationale
- SSE is unidirectional (server → client) — that's exactly what we need. Browser never needs to push events back.
- Works natively as a `Response` with `Content-Type: text/event-stream` in Next.js — no extra packages
- Automatic reconnect built into browser `EventSource` API
- Much simpler than WebSockets (no upgrade, no ws library, no separate server)

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| WebSockets | Bidirectional overkill; needs separate WS server or socket.io |
| Long polling | Wastes connections; adds latency |
| Client polling every N seconds | Simple but 1-5s lag is too slow for the "live" feeling |

## Consequences
- Heartbeat every 25s needed to prevent proxy/CDN from closing idle connections
- On reconnect, browser does a full refresh (not just the missed events) — acceptable for our use case
- Only works server → browser, not browser → server (not needed)
- Single-process only — if we add horizontal scaling, need a pub/sub layer (Redis) instead of the in-process bus
