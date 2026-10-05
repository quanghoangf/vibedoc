"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useApp } from "@/context/AppContext"
import { toast } from "@/components/ui/toast"
import { isSuiteRunning, type SuiteState } from "@/lib/suite"

/**
 * The project's regression suite (R064), like useTestRun: one module store fed by SSE `suite_run` (through
 * AppContext's `vibedoc:sse` window event) and seeded by `GET /api/suite/run`.
 */
type Snapshot = { root: string | null; suite: SuiteState | null }
let snap: Snapshot = { root: null, suite: null }
const listeners = new Set<() => void>()

function set(suite: SuiteState | null, root = snap.root) {
  // A late POST response never moves the same suite back to `starting` (SSE may already be past it)
  if (suite?.state === "starting" && snap.suite?.startedAt === suite.startedAt && snap.suite.state !== "starting" && snap.root === root) return
  snap = { root, suite }
  for (const l of listeners) l()
}

function onSse(e: Event) {
  const msg = (e as CustomEvent<{ type: string; payload?: { suite?: SuiteState } }>).detail
  if (msg?.type === "suite_run" && msg.payload?.suite) set(msg.payload.suite)
}

function subscribe(cb: () => void) {
  if (!listeners.size) window.addEventListener("vibedoc:sse", onSse)
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (!listeners.size) window.removeEventListener("vibedoc:sse", onSse)
  }
}

const getSnapshot = () => snap
const EMPTY: Snapshot = { root: null, suite: null }

export function useSuiteRun() {
  const { rootParam } = useApp()
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)

  useEffect(() => {
    if (snap.root === rootParam) return
    let live = true
    fetch(`/api/suite/run${rootParam}`)
      .then((r) => r.json())
      .then((d) => { if (live) set(d?.suite ?? null, rootParam) })
      .catch(() => { if (live) set(null, rootParam) })
    return () => { live = false }
  }, [rootParam])

  // `keep`: take the response's state; a cancel's response predates the kill (SSE `cancelled` may already be in)
  const post = useCallback(async (url: string, keep: boolean) => {
    const res = await fetch(`${url}${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    const json = await res.json().catch(() => null)
    if (!res.ok) toast(json?.error ?? `Request failed (${res.status})`)
    else if (keep && json?.suite) set(json.suite, rootParam)
  }, [rootParam])

  const suite = s.root === rootParam ? s.suite : null
  return {
    suite,
    busy: isSuiteRunning(suite),
    start: () => post("/api/suite/run", true),
    stop: () => post("/api/suite/run/cancel", false),
  }
}
