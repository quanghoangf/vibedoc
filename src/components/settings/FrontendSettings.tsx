"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { formatSteps, playwrightInstallSteps, type FrontendApp, type FrontendOverride, type PlaywrightStatus } from "@/lib/frontend"
import { toast } from "@/components/ui/toast"

const FIELD = "h-8 min-w-0 rounded-md border border-border bg-bg px-2 font-mono text-sm text-txt focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50"

type FrontendData = { app: FrontendApp | null; notes: string[]; override: FrontendOverride | null; playwright: PlaywrightStatus | null }

const toData = (json: Partial<FrontendData> | null): FrontendData =>
  ({ app: json?.app ?? null, notes: json?.notes ?? [], override: json?.override ?? null, playwright: json?.playwright ?? null })

const FRAMEWORK_LABEL: Record<FrontendApp["framework"], string> = {
  next: "Next.js", vite: "Vite", remix: "Remix", astro: "Astro", nuxt: "Nuxt",
  sveltekit: "SvelteKit", cra: "Create React App", unknown: "Unknown",
}

export function FrontendSettings({ rootParam }: { rootParam: string }) {
  const [data, setData] = useState<FrontendData | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/frontend${rootParam}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(json => { if (!signal?.cancelled) setData(toData(json)) })
      .catch(() => { if (!signal?.cancelled) setError(true) })
  }, [rootParam])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    // Another tab or an agent saved an override: show it live
    const onSse = (e: Event) => { if ((e as CustomEvent<{ type?: string }>).detail?.type === "frontend_updated") load(signal) }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load])

  const save = async (override: FrontendOverride | null) => {
    const res = await fetch(`/api/frontend${rootParam}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (!res?.ok) return toast(json?.error ?? "Couldn’t save the frontend app")
    setData(toData(json))
  }

  const app = data?.app
  const rows: [string, string, boolean?][] = app
    ? [
        ["Name", app.name],
        ["Framework", FRAMEWORK_LABEL[app.framework]],
        ["Directory", app.dir, true],
        ["Start command", app.startCommand, true],
        ["URL", app.url, true],
        ["Source", app.source === "override" ? "Your override (.vibedoc/settings.json)" : "Detected"],
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">Frontend app</h2>
        <p className="text-sm text-muted">The web app VibeDoc found in this project, how to start it and where it runs.</p>
      </div>

      {error ? (
        <p className="text-sm text-muted">Couldn’t read the project’s frontend app.</p>
      ) : !data ? (
        <p className="text-sm text-muted">Looking for a web frontend…</p>
      ) : !app ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <div className="text-sm font-medium text-txt">No web frontend found</div>
          <div className="mt-1 text-xs text-muted">VibeDoc looks for Next, Vite, Remix, Astro, Nuxt, SvelteKit or Create React App in the root package.json and its workspace packages.</div>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="divide-y divide-border rounded-lg border border-border" data-testid="frontend-app">
            {rows.map(([label, value, mono]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-sm text-muted">{label}</dt>
                <dd className={mono ? "min-w-0 truncate font-mono text-sm text-txt" : "min-w-0 truncate text-sm text-txt"}>{value}</dd>
              </div>
            ))}
          </dl>
          {data.notes.map(note => (
            <p key={note} className="flex items-start gap-2 text-xs text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />
              {note}
            </p>
          ))}
          {data.playwright && <PlaywrightRow app={app} status={data.playwright} rootParam={rootParam} />}
        </div>
      )}

      {data && !error && (
        <OverrideForm key={JSON.stringify([data.app, data.override])} app={data.app} override={data.override} onSave={save} />
      )}
    </div>
  )
}

/** Save sends only what differs from what's shown, so overriding the URL keeps the detected start command. */
function OverrideForm({ app, override, onSave }: {
  app: FrontendApp | null; override: FrontendOverride | null; onSave: (o: FrontendOverride | null) => Promise<unknown>
}) {
  const [dir, setDir] = useState(app?.dir ?? "")
  const [startCommand, setStartCommand] = useState(app?.startCommand ?? "")
  const [url, setUrl] = useState(app?.url ?? "")
  const [busy, setBusy] = useState(false)
  const candidates = app?.candidates ?? []
  const dirChanged = dir !== (app?.dir ?? "")
  const changed = dirChanged || startCommand !== (app?.startCommand ?? "") || url !== (app?.url ?? "")

  const run = async (o: FrontendOverride | null) => { setBusy(true); await onSave(o); setBusy(false) }
  const submit = () => run({
    // A new app drops the old app's command/URL overrides; otherwise earlier overrides stay
    ...(dirChanged ? { dir } : override),
    ...(startCommand !== (app?.startCommand ?? "") && { startCommand }),
    ...(url !== (app?.url ?? "") && { url }),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 rounded-lg border border-dashed border-border2 p-3" data-testid="frontend-override">
      <div>
        <p className="text-sm font-medium text-txt">Wrong guess? Override it</p>
        <p className="text-xs text-muted">Saved to <code className="font-mono">.vibedoc/settings.json</code> under <code className="font-mono">frontend</code>. Fields you don’t change keep following detection.</p>
      </div>
      {candidates.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          App
          <select aria-label="Frontend app" value={dir} onChange={(e) => setDir(e.target.value)} className={FIELD}>
            {candidates.map(c => <option key={c.dir} value={c.dir}>{c.dir} · {c.name} ({FRAMEWORK_LABEL[c.framework]})</option>)}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Start command
        <input aria-label="Start command" value={startCommand} onChange={(e) => setStartCommand(e.target.value)} disabled={dirChanged} placeholder="pnpm run dev" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        URL
        <input aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} disabled={dirChanged} placeholder="http://localhost:5173" className={FIELD} />
      </label>
      {dirChanged && <p className="text-xs text-muted">Save to switch apps; its start command and URL are detected again.</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!changed || busy} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">Save</button>
        {override && (
          <button type="button" disabled={busy} onClick={() => run(null)} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2 disabled:opacity-40">Reset to detected</button>
        )}
      </div>
    </form>
  )
}

type InstallState = { running: boolean; output: string; failed: boolean }

/** T141: status pill + the install command (Copy / Install). Install streams NDJSON from the route; SSE refreshes the pill. */
function PlaywrightRow({ app, status, rootParam }: { app: FrontendApp; status: PlaywrightStatus; rootParam: string }) {
  const [install, setInstall] = useState<InstallState | null>(null)
  const logRef = useRef<HTMLPreElement>(null)
  const steps = playwrightInstallSteps(app.packageManager, status)
  const command = formatSteps(steps)
  const pill = status.installed
    ? status.browsersInstalled === false
      ? { label: `Installed${status.version ? ` v${status.version}` : ""} · Chromium missing`, cls: "border-amber/40 bg-amber/10 text-amber" }
      : { label: `Installed${status.version ? ` v${status.version}` : ""}`, cls: "border-green-400/40 bg-green-400/10 text-green-400" }
    : { label: "Not installed", cls: "border-border bg-surface2 text-muted" }

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, [install?.output])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      toast("Command copied")
    } catch {
      toast("Couldn’t copy the command")
    }
  }

  const run = async () => {
    setInstall({ running: true, output: "", failed: false })
    const res = await fetch(`/api/frontend/playwright/install${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    if (!res?.ok || !res.body) {
      const json = await res?.json().catch(() => null)
      setInstall({ running: false, output: json?.error ?? "Couldn’t start the install", failed: true })
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let pending = ""
    let output = ""
    let failed = true // no "done" line = the stream broke
    let tail = ""
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }))
      if (done) break
      const lines = (pending + decoder.decode(value, { stream: true })).split("\n")
      pending = lines.pop() ?? ""
      for (const line of lines) {
        let msg: { type?: string; text?: string; ok?: boolean; tail?: string }
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.type === "output") output += msg.text ?? ""
        if (msg.type === "done") { failed = !msg.ok; tail = msg.tail ?? "" }
      }
      setInstall({ running: true, output, failed: false })
    }
    // Failure: keep only the tail, which is what explains it
    setInstall({ running: false, output: failed ? (tail || output).trimEnd() : output, failed })
    if (!failed) toast("Playwright installed")
  }

  return (
    <div className="space-y-2 rounded-lg border border-border px-4 py-3" data-testid="frontend-playwright">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">Playwright</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill.cls}`} data-testid="playwright-pill">{pill.label}</span>
      </div>
      {steps.length > 0 && (
        <>
          <p className="text-xs text-muted">
            Auto-tests need it in the app. Run in <code className="font-mono">{app.dir}</code>:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-txt" title={command}>{command}</code>
            <button type="button" onClick={copy} className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2">Copy</button>
            <button type="button" onClick={run} disabled={install?.running} className="inline-flex h-8 shrink-0 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">
              {install?.running ? "Installing…" : "Install"}
            </button>
          </div>
        </>
      )}
      {install && install.output && (
        <div className="space-y-1">
          {install.failed && <p className="text-xs text-red-400" role="alert">Install failed. Last output:</p>}
          <pre ref={logRef} className="max-h-48 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-snug text-muted" data-testid="playwright-install-log">{install.output}</pre>
        </div>
      )}
    </div>
  )
}
