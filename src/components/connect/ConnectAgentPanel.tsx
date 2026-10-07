"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Circle, Copy, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { useOrigin } from "@/hooks/use-origin"
import { agentLabel, claudeMcpAddCommand, claudeMcpRemoveCommand } from "@/lib/agent-connect"

interface McpStatus { connected: boolean; agent: string | null; lastCall: string | null }

/**
 * R081: the steps to connect a coding agent, each ✓ only from evidence (an MCP tool call received).
 * Fetches its own status, so the welcome screen (R082) can mount it as is; Settings passes the configured MCP URL.
 */
export function ConnectAgentPanel({ mcpUrl }: { mcpUrl?: string }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const { timeAgo } = useFormat()
  const origin = useOrigin()
  const url = mcpUrl || `${origin}/api/mcp`
  const [mcp, setMcp] = useState<McpStatus | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/agent-connect${rootParam}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(d => { if (!signal?.cancelled) { setMcp(d?.mcp ?? null); setFailed(false) } })
      .catch(e => {
        console.warn("[vibedoc] could not load the agent connection:", e)
        if (!signal?.cancelled) setFailed(true)
      })
  }, [rootParam])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    // The first tool call arrives as SSE agent_connected (AppContext re-dispatches every event on window)
    const onSse = (e: Event) => { if ((e as CustomEvent).detail?.type === "agent_connected") load(signal) }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load])

  const done = mcp?.connected === true
  return (
    <section className="space-y-4" aria-labelledby="connect-agent-title">
      <div>
        <h2 id="connect-agent-title" className="text-xl font-semibold text-txt mb-1">{t("connect.title")}</h2>
        <p className="text-sm text-muted">{t("connect.hint")}</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3" role="group" aria-labelledby="connect-step-mcp">
        <div className="flex items-start gap-3">
          <StepMark done={done} />
          <div className="min-w-0">
            <h3 id="connect-step-mcp" className="text-sm font-medium text-txt">{t("connect.stepMcp")}</h3>
            <p className="text-xs text-muted">{t("connect.stepMcpHint")}</p>
          </div>
        </div>

        <ClaudeMcpConnect url={url} />

        <div className="space-y-1">
          <div className="text-xs text-muted">{t("connect.runInProject")}</div>
          <CommandBlock command={claudeMcpAddCommand(url)} />
        </div>

        <p className={cn("text-sm", done ? "text-green-400" : "text-muted")} role="status">
          {failed
            ? t("connect.loadFailed")
            : done && mcp?.lastCall
              ? t("connect.connected", { agent: agentLabel(mcp.agent) ?? t("connect.someAgent"), ago: timeAgo(mcp.lastCall) })
              : t("connect.waiting", { agent: "Claude Code" })}
        </p>
      </div>
    </section>
  )
}

interface ConnectResult { ok: boolean; missing: boolean; exists: boolean; output: string; error: string | null }

/** One-click `claude mcp add` (S1): nothing runs until the user confirms the exact command; the result names what changed. */
function ClaudeMcpConnect({ url }: { url: string }) {
  const { rootParam, activeProject } = useApp()
  const { t } = useT()
  const [confirm, setConfirm] = useState<"add" | "replace" | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ConnectResult | null>(null)
  const commands = confirm === "replace"
    ? [claudeMcpRemoveCommand(), claudeMcpAddCommand(url)]
    : [claudeMcpAddCommand(url)]

  const run = async (replace: boolean) => {
    setConfirm(null)
    setRunning(true)
    try {
      const res = await fetch(`/api/agent-connect${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "mcp", url, replace }),
      })
      const d = await res.json().catch(() => null)
      setResult({
        ok: res.ok && d?.ok === true, missing: d?.missing === true, exists: d?.exists === true,
        output: d?.output ?? "", error: d?.error ?? (res.ok ? null : String(res.status)),
      })
    } catch (e) {
      setResult({ ok: false, missing: false, exists: false, output: "", error: (e as Error).message })
    }
    setRunning(false)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setConfirm("add")}
        disabled={running}
        className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
      >
        {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("connect.connectClaude")}
      </button>

      {result?.ok && (
        <div className="space-y-1 text-sm text-green-400" role="status">
          <div>{t("connect.changed")}</div>
          <pre className="whitespace-pre-wrap break-all rounded bg-surface2 p-2 font-mono text-xs text-txt">{result.output}</pre>
        </div>
      )}
      {result && !result.ok && (
        <div className="space-y-1 text-sm" role="alert">
          <div className="text-amber-400">
            {result.missing ? t("connect.claudeMissing") : result.exists ? t("connect.alreadyExists") : t("connect.claudeError")}
          </div>
          {!result.missing && result.error && (
            <pre className="whitespace-pre-wrap break-all rounded bg-surface2 p-2 font-mono text-xs text-txt">{result.error}</pre>
          )}
          {result.exists ? (
            <button type="button" onClick={() => setConfirm("replace")} className="rounded-lg border border-border px-3 py-1 text-sm text-txt hover:bg-surface2">
              {t("connect.replace")}
            </button>
          ) : (
            <div className="text-xs text-muted">{t("connect.runYourself")}</div>
          )}
        </div>
      )}

      {confirm && (
        <Dialog open onOpenChange={(v) => { if (!v) setConfirm(null) }}>
          <DialogContent className="max-w-lg space-y-3">
            <DialogTitle className="text-sm font-semibold text-txt">
              {confirm === "replace" ? t("connect.confirmReplaceTitle") : t("connect.confirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted">
              {t("connect.confirmBody", { root: activeProject ?? "" })}
            </DialogDescription>
            {commands.map(c => <CommandBlock key={c} command={c} />)}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-txt">
                {t("connect.cancel")}
              </button>
              <button type="button" onClick={() => run(confirm === "replace")} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90">
                {confirm === "replace" ? t("connect.confirmReplace") : t("connect.confirm")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function StepMark({ done }: { done: boolean }) {
  const { t } = useT()
  return done
    ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" aria-label={t("connect.done")} />
    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-label={t("connect.notDone")} />
}

export function CommandBlock({ command }: { command: string }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn("[vibedoc] copy failed:", e)
    }
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-surface2 p-2">
      <code className="min-w-0 flex-1 break-all font-mono text-xs text-txt">{command}</code>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          copied ? "bg-green-500/20 text-green-400" : "text-muted hover:text-txt",
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? t("connect.copied") : t("connect.copy")}
      </button>
    </div>
  )
}
