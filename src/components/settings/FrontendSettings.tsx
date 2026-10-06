"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { formatSteps, playwrightInstallSteps, type FrontendApp, type FrontendAuth, type FrontendOverride, type PlaywrightStatus, type SmokeResult } from "@/lib/frontend"
import { toast } from "@/components/ui/toast"
import { useFormat, useT } from "@/context/LanguageContext"

const FIELD = "h-8 min-w-0 rounded-md border border-border bg-bg px-2 font-mono text-sm text-txt focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50"

type LoginState = { running: boolean; unavailable: string | null }
type FrontendData = {
  app: FrontendApp | null; notes: string[]; override: FrontendOverride | null; playwright: PlaywrightStatus | null
  auth: FrontendAuth; login: LoginState
}

const toData = (json: Partial<FrontendData> | null): FrontendData => ({
  app: json?.app ?? null, notes: json?.notes ?? [], override: json?.override ?? null, playwright: json?.playwright ?? null,
  auth: json?.auth ?? { saved: false }, login: { running: json?.login?.running ?? false, unavailable: json?.login?.unavailable ?? null },
})

const FRAMEWORK_LABEL: Record<FrontendApp["framework"], string> = {
  next: "Next.js", vite: "Vite", remix: "Remix", astro: "Astro", nuxt: "Nuxt",
  sveltekit: "SvelteKit", cra: "Create React App", unknown: "Unknown",
}

/** The detection / smoke notes src/lib/frontend.ts writes (English, also read by MCP), in the UI language. */
function useNoteText(): (note: string) => string {
  const { t } = useT()
  return (note) => {
    if (note === "This is VibeDoc’s own repo.") return t("settings.noteOwnRepo")
    if (note === "No saved session: opened logged out (Log in above to save one).") return t("settings.noteNoSession")
    const port = /^Port (\d+) is VibeDoc’s own port/.exec(note)
    if (port) return t("settings.noteOwnPort", { port: port[1] })
    const out = /^Looks logged out: it ended on (.+), the login path\.$/.exec(note)
    if (out) return t("settings.noteLoggedOut", { path: out[1] })
    return note
  }
}

export function FrontendSettings({ rootParam }: { rootParam: string }) {
  const [data, setData] = useState<FrontendData | null>(null)
  const [error, setError] = useState(false)
  const { t } = useT()
  const noteText = useNoteText()

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
    const onSse = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; payload?: { loginError?: string | null } }>).detail
      if (detail?.type !== "frontend_updated") return
      load(signal)
      if (detail.payload?.loginError) toast(t("settings.loginFailed", { error: detail.payload.loginError }))
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load, t])

  const save = async (override: FrontendOverride | null) => {
    const res = await fetch(`/api/frontend${rootParam}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (!res?.ok) return toast(json?.error ?? t("settings.cantSaveFrontend"))
    setData(toData(json))
  }

  const app = data?.app
  const rows: [string, string, boolean?][] = app
    ? [
        [t("settings.rowName"), app.name, false],
        [t("settings.rowFramework"), app.framework === "unknown" ? t("settings.unknown") : FRAMEWORK_LABEL[app.framework]],
        [t("settings.rowDirectory"), app.dir, true],
        [t("settings.rowStart"), app.startCommand, true],
        [t("settings.rowUrl"), app.url, true],
        [t("settings.rowSource"), app.source === "override" ? t("settings.sourceOverride") : t("settings.sourceDetected")],
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabFrontend")}</h2>
        <p className="text-sm text-muted">{t("settings.frontendHint")}</p>
      </div>

      {error ? (
        <p className="text-sm text-muted">{t("settings.cantReadFrontend")}</p>
      ) : !data ? (
        <p className="text-sm text-muted">{t("settings.lookingFrontend")}</p>
      ) : !app ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <div className="text-sm font-medium text-txt">{t("settings.noFrontend")}</div>
          <div className="mt-1 text-xs text-muted">{t("settings.noFrontendHint")}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="divide-y divide-border rounded-lg border border-border" data-testid="frontend-app">
            {rows.map(([label, value, mono]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-sm text-muted">{label}</dt>
                <dd data-user-content={mono || label === t("settings.rowName") ? true : undefined} className={mono ? "min-w-0 truncate font-mono text-sm text-txt" : "min-w-0 truncate text-sm text-txt"}>{value}</dd>
              </div>
            ))}
          </dl>
          {data.notes.map(note => (
            <p key={note} className="flex items-start gap-2 text-xs text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />
              {noteText(note)}
            </p>
          ))}
          <ServerRow url={app.url} rootParam={rootParam} />
          {data.playwright && <PlaywrightRow app={app} status={data.playwright} rootParam={rootParam} />}
          <LoginRow data={data} rootParam={rootParam} onChange={setData} />
          <SmokeRow playwright={data.playwright} rootParam={rootParam} />
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
  const [loginPath, setLoginPath] = useState(app?.loginPath ?? "")
  const [busy, setBusy] = useState(false)
  const { t } = useT()
  const candidates = app?.candidates ?? []
  const dirChanged = dir !== (app?.dir ?? "")
  const loginPathChanged = loginPath !== (app?.loginPath ?? "")
  const changed = dirChanged || startCommand !== (app?.startCommand ?? "") || url !== (app?.url ?? "") || loginPathChanged

  const run = async (o: FrontendOverride | null) => { setBusy(true); await onSave(o); setBusy(false) }
  const submit = () => run({
    // A new app drops the old app's command/URL overrides; otherwise earlier overrides stay
    ...(dirChanged ? { dir } : override),
    ...(startCommand !== (app?.startCommand ?? "") && { startCommand }),
    ...(url !== (app?.url ?? "") && { url }),
    // Empty clears it (the server drops empty fields); switching apps keeps it unless edited
    ...(loginPathChanged ? { loginPath } : dirChanged && app?.loginPath ? { loginPath: app.loginPath } : {}),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 rounded-lg border border-dashed border-border2 p-3" data-testid="frontend-override">
      <div>
        <p className="text-sm font-medium text-txt">{t("settings.overrideTitle")}</p>
        <p className="text-xs text-muted">{t("settings.overrideSavedTo")} <code className="font-mono">.vibedoc/settings.json</code> {t("settings.overrideUnder")} <code className="font-mono">frontend</code>. {t("settings.overrideKeep")}</p>
      </div>
      {candidates.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("settings.app")}
          <select aria-label={t("settings.frontendApp")} value={dir} onChange={(e) => setDir(e.target.value)} className={FIELD}>
            {candidates.map(c => <option key={c.dir} value={c.dir} data-user-content>{c.dir} · {c.name} ({FRAMEWORK_LABEL[c.framework]})</option>)}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("settings.rowStart")}
        <input aria-label={t("settings.rowStart")} value={startCommand} onChange={(e) => setStartCommand(e.target.value)} disabled={dirChanged} placeholder="pnpm run dev" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        URL
        <input aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} disabled={dirChanged} placeholder="http://localhost:5173" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("settings.loginPathOptional")}
        <input aria-label={t("settings.loginPath")} value={loginPath} onChange={(e) => setLoginPath(e.target.value)} placeholder="/login" className={FIELD} />
      </label>
      {dirChanged && <p className="text-xs text-muted">{t("settings.switchHint")}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!changed || busy} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">{t("settings.save")}</button>
        {override && (
          <button type="button" disabled={busy} onClick={() => run(null)} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2 disabled:opacity-40">{t("settings.resetDetected")}</button>
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
  const { t } = useT()
  const steps = playwrightInstallSteps(app.packageManager, status)
  const command = formatSteps(steps)
  const installed = status.version ? t("settings.installedVersion", { version: status.version }) : t("settings.installed")
  const pill = status.installed
    ? status.browsersInstalled === false
      ? { label: t("settings.chromiumMissing", { label: installed }), cls: "border-amber/40 bg-amber/10 text-amber" }
      : { label: installed, cls: "border-green-400/40 bg-green-400/10 text-green-400" }
    : { label: t("settings.notInstalled"), cls: "border-border bg-surface2 text-muted" }

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, [install?.output])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      toast(t("settings.commandCopied"))
    } catch {
      toast(t("settings.cantCopyCommand"))
    }
  }

  const run = async () => {
    setInstall({ running: true, output: "", failed: false })
    const res = await fetch(`/api/frontend/playwright/install${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    if (!res?.ok || !res.body) {
      const json = await res?.json().catch(() => null)
      setInstall({ running: false, output: json?.error ?? t("settings.cantStartInstall"), failed: true })
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
    if (!failed) toast(t("settings.playwrightInstalled"))
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
            {t("settings.autoTestsNeed")} <code className="font-mono" data-user-content>{app.dir}</code>:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-txt" title={command}>{command}</code>
            <button type="button" onClick={copy} className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2">{t("settings.copy")}</button>
            <button type="button" onClick={run} disabled={install?.running} className="inline-flex h-8 shrink-0 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">
              {install?.running ? t("settings.installing") : t("settings.install")}
            </button>
          </div>
        </>
      )}
      {install && install.output && (
        <div className="space-y-1">
          {install.failed && <p className="text-xs text-red-400" role="alert">{t("settings.installFailed")}</p>}
          <pre ref={logRef} data-user-content className="max-h-48 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-snug text-muted" data-testid="playwright-install-log">{install.output}</pre>
        </div>
      )}
    </div>
  )
}

type ServerStatus = { state: "stopped" | "starting" | "running"; startedByUs: boolean; reused?: boolean; error?: string; output?: string }

const SERVER_PILL: Record<ServerStatus["state"], { label: "settings.running" | "settings.starting" | "settings.stopped"; cls: string }> = {
  running: { label: "settings.running", cls: "border-green-400/40 bg-green-400/10 text-green-400" },
  starting: { label: "settings.starting", cls: "border-amber/40 bg-amber/10 text-amber" },
  stopped: { label: "settings.stopped", cls: "border-border bg-surface2 text-muted" },
}

/** T142: dev server state + Start / Stop. Stop only works on a server VibeDoc started; SSE keeps other tabs live. */
function ServerRow({ url, rootParam }: { url: string; rootParam: string }) {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [busy, setBusy] = useState<"start" | "stop" | null>(null)
  const { t } = useT()

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/frontend/server${rootParam}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: ServerStatus) => { if (!signal?.cancelled) setStatus(s => ({ ...json, reused: s?.reused && json.state === "running" && !json.startedByUs })) })
      .catch(() => { if (!signal?.cancelled) setStatus(null) })
  }, [rootParam])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type
      if (type === "frontend_server_updated" || type === "frontend_updated") load(signal)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load])

  const act = async (action: "start" | "stop") => {
    setBusy(action)
    if (action === "start") setStatus(s => ({ ...(s ?? { startedByUs: false }), state: "starting", error: undefined, output: undefined }))
    const res = await fetch(`/api/frontend/server${rootParam}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      setStatus({ state: "stopped", startedByUs: false, error: json?.error ?? t(action === "start" ? "settings.cantStartApp" : "settings.cantStopApp"), output: json?.output ?? "" })
      return
    }
    setStatus({ state: json?.state ?? "stopped", startedByUs: json?.startedByUs ?? false, reused: json?.reused ?? false })
    if (json?.reused) toast(t("settings.reusedToast"))
  }

  const state = status?.state ?? "stopped"
  const pill = SERVER_PILL[state]
  const canStop = state === "running" && !!status?.startedByUs && busy === null
  const note = state === "running"
    ? t(status?.startedByUs ? "settings.startedByUs" : status?.reused ? "settings.reusedNote" : "settings.outsideNote")
    : state === "starting" ? t("settings.waitingUrl") : null

  return (
    <div className="space-y-2 rounded-lg border border-border px-4 py-3" data-testid="frontend-server">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">{t("settings.devServer")}</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill.cls}`} data-testid="server-pill">{status?.reused && state === "running" ? t("settings.runningReused") : t(pill.label)}</span>
          <button type="button" onClick={() => act("start")} disabled={state === "starting" || (state === "running" && !!status?.startedByUs) || busy !== null} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">{t("settings.start")}</button>
          <button type="button" onClick={() => act("stop")} disabled={!canStop} title={state === "running" && !status?.startedByUs ? t("settings.notOurServer") : undefined} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2 disabled:opacity-40">{t("settings.stop")}</button>
        </div>
      </div>
      {note && <p className="text-xs text-muted">{note} <code className="font-mono" data-user-content>{url}</code></p>}
      {status?.error && (
        <div className="space-y-1">
          <p className="text-xs text-red-400" role="alert" data-user-content>{status.error}</p>
          {status.output && <pre data-user-content className="max-h-48 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-snug text-muted" data-testid="server-output">{status.output}</pre>}
        </div>
      )}
    </div>
  )
}

/** T143: Log in opens the app in a headed Chromium; closing it saves the session for every later test. */
function LoginRow({ data, rootParam, onChange }: { data: FrontendData; rootParam: string; onChange: (d: FrontendData) => void }) {
  const f = useFormat()
  const { t } = useT()
  const [busy, setBusy] = useState<"open" | "clear" | null>(null)
  const { auth, login, playwright } = data
  const blocked = login.unavailable
    ?? (playwright && !playwright.installed ? t("settings.installPlaywrightLogin")
      : playwright?.browsersInstalled === false ? t("settings.installChromiumLogin") : null)

  const call = async (method: "POST" | "DELETE") => {
    setBusy(method === "POST" ? "open" : "clear")
    const res = await fetch(`/api/frontend/login${rootParam}`, { method, headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setBusy(null)
    if (!res?.ok) return toast(json?.error ?? t(method === "POST" ? "settings.cantOpenBrowser" : "settings.cantClearSession"))
    if (method === "POST") {
      onChange({ ...data, login: { ...login, running: true } })
      toast(t("settings.loginInWindow"))
    } else {
      onChange({ ...data, auth: json?.auth ?? { saved: false } })
      toast(t("settings.sessionCleared"))
    }
  }

  const status = login.running
    ? t("settings.browserOpen")
    : auth.saved
      ? auth.savedAt ? t("settings.sessionSavedAt", { date: f.dateTime(auth.savedAt) }) : t("settings.sessionSaved")
      : t("settings.noSession")

  return (
    <div className="space-y-2 rounded-lg border border-border px-4 py-3" data-testid="frontend-login">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">{t("settings.loginSession")}</span>
        <div className="flex items-center gap-2">
          {auth.saved && (
            <button type="button" onClick={() => call("DELETE")} disabled={busy !== null || login.running} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-txt hover:bg-surface2 disabled:opacity-40">{t("settings.clearSession")}</button>
          )}
          <button type="button" onClick={() => call("POST")} disabled={!!blocked || busy !== null || login.running} title={blocked ?? undefined} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">
            {busy === "open" ? t("settings.opening") : t("settings.logIn")}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted" data-testid="login-status">{status}</p>
      {blocked && <p className="text-xs text-muted">{blocked}</p>}
      {auth.saved && <p className="text-xs text-muted">{t("settings.storedIn")} <code className="font-mono">.vibedoc/auth/</code>, {t("settings.storedGitIgnored")}</p>}
    </div>
  )
}

/** T144: Run smoke test starts the app if needed, opens its first page headless with the saved session and shows a screenshot. */
function SmokeRow({ playwright, rootParam }: { playwright: PlaywrightStatus | null; rootParam: string }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SmokeResult | null>(null)
  const [shotKey, setShotKey] = useState(0)
  const { t } = useT()
  const noteText = useNoteText()
  // Headless: no DISPLAY needed, only the app's Playwright + Chromium
  const blocked = playwright && !playwright.installed ? t("settings.installPlaywrightSmoke")
    : playwright?.browsersInstalled === false ? t("settings.installChromiumFirst") : null

  const run = async () => {
    setRunning(true)
    const res = await fetch(`/api/frontend/smoke${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null)
    const json = await res?.json().catch(() => null)
    setRunning(false)
    if (!res?.ok) {
      setResult({ ok: false, durationMs: 0, startedServer: false, screenshot: false, notes: [], error: json?.error ?? t("settings.cantRunSmoke") })
      return
    }
    setResult({
      ok: json?.ok ?? false, finalUrl: json?.finalUrl, status: json?.status ?? null, durationMs: json?.durationMs ?? 0,
      startedServer: json?.startedServer ?? false, screenshot: json?.screenshot ?? false, notes: json?.notes ?? [], error: json?.error,
    })
    setShotKey(Date.now())
  }

  const shotParams = new URLSearchParams(rootParam)
  shotParams.set("t", String(shotKey))

  return (
    <div className="space-y-2 rounded-lg border border-border px-4 py-3" data-testid="frontend-smoke">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">{t("settings.smokeTest")}</span>
        <div className="flex items-center gap-2">
          {result && !running && (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${result.ok ? "border-green-400/40 bg-green-400/10 text-green-400" : "border-red-400/40 bg-red-400/10 text-red-400"}`} data-testid="smoke-pill">
              {result.ok ? t("settings.passed") : t("settings.failed")}
            </span>
          )}
          <button type="button" onClick={run} disabled={!!blocked || running} title={blocked ?? undefined} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">
            {running ? t("settings.runningEllipsis") : t("settings.runSmoke")}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        {running ? t("settings.smokeStarting") : t("settings.smokeHint")}
      </p>
      {blocked && <p className="text-xs text-muted">{blocked}</p>}
      {result && !running && (
        <div className="space-y-2" data-testid="smoke-result">
          {result.error && <p className="whitespace-pre-wrap text-xs text-red-400" role="alert" data-user-content>{result.error}</p>}
          {result.finalUrl && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted">{t("settings.finalUrl")}</dt>
              <dd className="min-w-0 truncate font-mono text-txt" data-testid="smoke-url">{result.finalUrl}</dd>
              <dt className="text-muted">{t("settings.httpStatus")}</dt>
              <dd className="font-mono text-txt">{result.status ?? "–"}</dd>
              <dt className="text-muted">{t("settings.duration")}</dt>
              <dd className="font-mono text-txt">{(result.durationMs / 1000).toFixed(1)}s{result.startedServer ? t("settings.startedStopped") : ""}</dd>
            </dl>
          )}
          {result.notes.map(note => (
            <p key={note} className="flex items-start gap-2 text-xs text-muted" data-testid="smoke-note">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />
              {noteText(note)}
            </p>
          ))}
          {result.screenshot && (
            // eslint-disable-next-line @next/next/no-img-element -- an API route image, no optimisation wanted
            <img src={`/api/frontend/smoke?${shotParams}`} alt={t("settings.screenshotOf", { url: result.finalUrl ?? t("settings.theApp") })} className="w-full rounded-md border border-border" data-testid="smoke-shot" />
          )}
        </div>
      )}
    </div>
  )
}
