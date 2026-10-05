"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useApp } from "@/context/AppContext"
import { toast } from "@/components/ui/toast"
import { isRunning, type RunState } from "@/lib/test-run-events"

/**
 * The project's Run from VibeDoc (R061), shared by every Run control: one module store fed by the SSE bus
 * (`test_run` via AppContext's `vibedoc:sse` window event) and seeded by `GET /api/tasks/run`. `began` holds the
 * client time each step started, for its elapsed clock (the events carry no times).
 */
type Snapshot = { root: string | null; run: RunState | null; began: Record<number, number>; ended: Record<number, number> }
let snap: Snapshot = { root: null, run: null, began: {}, ended: {} }
const listeners = new Set<() => void>()

function set(run: RunState | null, root = snap.root) {
  // A late POST response never moves the same run back to `starting` (SSE may already be past it)
  if (run?.state === "starting" && snap.run?.startedAt === run.startedAt && snap.run.state !== "starting" && snap.root === root) return
  const fresh = !snap.run || !run || snap.run.startedAt !== run.startedAt || snap.root !== root
  const began = fresh ? {} : { ...snap.began }
  const ended = fresh ? {} : { ...snap.ended }
  const now = Date.now()
  for (const s of run?.steps ?? []) {
    began[s.index] ??= now
    if (s.status !== "running") ended[s.index] ??= now
  }
  snap = { root, run, began, ended }
  for (const l of listeners) l()
}

function onSse(e: Event) {
  const msg = (e as CustomEvent<{ type: string; payload?: { state?: RunState } }>).detail
  if (msg?.type === "test_run" && msg.payload?.state) set(msg.payload.state)
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
const EMPTY: Snapshot = { root: null, run: null, began: {}, ended: {} }

export function useTestRun() {
  const { rootParam } = useApp()
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)

  // Seed once per project (a reload mid-run picks the run back up); SSE keeps it current after that
  useEffect(() => {
    if (snap.root === rootParam) return
    let live = true
    fetch(`/api/tasks/run${rootParam}`)
      .then((r) => r.json())
      .then((d) => { if (live) set(d?.run ?? null, rootParam) })
      .catch(() => { if (live) set(null, rootParam) })
    return () => { live = false }
  }, [rootParam])

  // `keep`: take the response's state. A cancel's response is the state before the kill; the SSE `cancelled`
  // can land first, so it must not be overwritten by it.
  const post = useCallback(async (url: string, body: unknown, keep: boolean) => {
    const res = await fetch(`${url}${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => null)
    if (!res.ok) toast(json?.error ?? `Request failed (${res.status})`)
    else if (keep && json?.run) set(json.run, rootParam)
  }, [rootParam])

  const run = s.root === rootParam ? s.run : null
  return {
    run,
    /** Started-at client times per step index, and when each one ended */
    began: s.began,
    ended: s.ended,
    busy: isRunning(run),
    start: (taskId: string) => post("/api/tasks/run", { id: taskId }, true),
    stop: () => post("/api/tasks/run/cancel", {}, false),
  }
}
