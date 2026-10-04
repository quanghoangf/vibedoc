"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import type { FrontendApp } from "@/lib/frontend"

const FRAMEWORK_LABEL: Record<FrontendApp["framework"], string> = {
  next: "Next.js", vite: "Vite", remix: "Remix", astro: "Astro", nuxt: "Nuxt",
  sveltekit: "SvelteKit", cra: "Create React App", unknown: "Unknown",
}

export function FrontendSettings({ rootParam }: { rootParam: string }) {
  const [data, setData] = useState<{ app: FrontendApp | null; notes: string[] } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/frontend${rootParam}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(json => { if (!cancelled) setData({ app: json?.app ?? null, notes: json?.notes ?? [] }) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [rootParam])

  const app = data?.app
  const rows: [string, string, boolean?][] = app
    ? [
        ["Name", app.name],
        ["Framework", FRAMEWORK_LABEL[app.framework]],
        ["Directory", app.dir, true],
        ["Start command", app.startCommand, true],
        ["URL", app.url, true],
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
          <div className="mt-1 text-xs text-muted">VibeDoc looks for Next, Vite, Remix, Astro, Nuxt, SvelteKit or Create React App in the root package.json.</div>
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
        </div>
      )}
    </div>
  )
}
