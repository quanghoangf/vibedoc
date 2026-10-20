"use client"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppSettings } from "@/lib/settings"
import { WORKER_BASE_ENV } from "@/lib/worker-args"
import { useT } from "@/context/LanguageContext"

/** What GET /api/workers answers: the effective settings (defaults filled in) plus the fixed deny rules. */
export interface WorkerTools { allowed: string[]; denied: string[]; maxRunning: number; env: string[]; maxTurnsPerTask: number; taskTimeoutMin: number }

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean)

/** Settings → Workers (R108 T557): `workers` in .vibedoc/settings.json. */
export function WorkersSettings({ settings, onSave, rootParam }: {
  settings: AppSettings
  onSave: (settings: AppSettings) => Promise<void>
  rootParam: string
}) {
  const { t } = useT()
  const [loaded, setLoaded] = useState<WorkerTools | null>(null)
  const [allowed, setAllowed] = useState("")
  const [env, setEnv] = useState("")
  const [max, setMax] = useState(1)
  const [turns, setTurns] = useState(1)
  const [timeoutMin, setTimeoutMin] = useState(1)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/workers${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: WorkerTools | null) => {
        if (!w) return
        setLoaded(w)
        setAllowed(w.allowed.join("\n"))
        setEnv(w.env.join("\n"))
        setMax(w.maxRunning)
        setTurns(w.maxTurnsPerTask)
        setTimeoutMin(w.taskTimeoutMin)
      })
      .catch((e) => console.warn("[vibedoc] could not read worker settings:", e))
  }, [rootParam])

  const save = async () => {
    const tools = lines(allowed)
    const count = (n: number) => Math.max(1, Math.floor(n) || 1)
    await onSave({ ...settings, workers: { ...(settings.workers?.verify === false && { verify: false }), ...(tools.length && { allowedTools: tools }), maxRunning: count(max), env: lines(env), maxTurnsPerTask: count(turns), taskTimeoutMin: count(timeoutMin) } })
    setSaved(true)
  }
  const field = "w-full rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-xs text-txt focus:border-accent/60 focus:outline-hidden"

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">{t("workers.settingsTab")}</h2>
        <p className="text-sm text-muted">{t("workers.settingsLead")}</p>
      </div>
      <p role="note" className="flex gap-2 rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs text-txt">
        <ShieldAlert className="size-4 shrink-0 text-amber" aria-hidden />
        {t("workers.notSandbox")}
      </p>
      {loaded && (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void save() }} onChange={() => setSaved(false)}>
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-txt">{t("workers.allowedTools")}</span>
            <span className="block text-xs text-muted">{t("workers.allowedToolsHint")}</span>
            <textarea value={allowed} onChange={(e) => setAllowed(e.target.value)} rows={10} spellCheck={false} className={field} />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-txt">{t("workers.alwaysDenied")}</span>
            <div className="flex flex-wrap gap-1">
              {loaded.denied.map((d) => <code key={d} className="rounded-sm border border-danger/30 px-1 font-mono text-[11px] text-danger">{d}</code>)}
            </div>
          </div>
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-txt">{t("workers.envNames")}</span>
            <span className="block text-xs text-muted">{t("workers.envNamesHint", { base: WORKER_BASE_ENV.join(" ") })}</span>
            <textarea value={env} onChange={(e) => setEnv(e.target.value)} rows={3} spellCheck={false} className={field} />
          </label>
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-txt">{t("workers.maxRunning")}</span>
            <input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))} className={`${field} max-w-24`} />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-txt">{t("workers.budgetPerTask")}</span>
            <span className="block text-xs text-muted">{t("workers.budgetHint")}</span>
            <div className="flex flex-wrap gap-4">
              <label className="space-y-1">
                <span className="block text-xs text-muted">{t("workers.maxTurnsPerTask")}</span>
                <input type="number" min={1} value={turns} onChange={(e) => setTurns(Number(e.target.value))} className={`${field} max-w-24`} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted">{t("workers.taskTimeoutMin")}</span>
                <input type="number" min={1} value={timeoutMin} onChange={(e) => setTimeoutMin(Number(e.target.value))} className={`${field} max-w-24`} />
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" className="bg-accent text-accent-fg hover:bg-accent/90">{t("workers.save")}</Button>
            {saved && <span role="status" className="text-xs text-muted">{t("workers.saved")}</span>}
          </div>
        </form>
      )}
    </div>
  )
}
