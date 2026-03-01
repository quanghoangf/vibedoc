/**
 * src/lib/events.ts
 * In-process SSE event bus.
 * API routes push events here; /api/events streams them to the browser.
 */

type Listener = (data: unknown) => void

class EventBus {
  private listeners = new Set<Listener>()

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(event: unknown) {
    this.listeners.forEach(fn => {
      try { fn(event) } catch {}
    })
  }
}

// Singleton — shared across all API routes in the same process
const globalForBus = globalThis as unknown as { vibedocBus?: EventBus }
export const bus = globalForBus.vibedocBus ?? (globalForBus.vibedocBus = new EventBus())

export function emitUpdate(type: string, payload: unknown) {
  bus.emit({ type, payload, ts: new Date().toISOString() })
}
