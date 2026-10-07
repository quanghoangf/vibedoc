"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Circle, Copy, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { useOrigin } from "@/hooks/use-origin"
import { agentLabel, claudeMcpAddCommand, claudeMcpRemoveCommand, CONNECT_AGENTS, mcpServersConfig, pluginInstallCommands, type ConnectAgent } from "@/lib/agent-connect"

interface McpStatus { connected: boolean; agent: string | null; lastCall: string | null }
interface SkillsStatus { installed: boolean; missing: boolean; error: string | null }

/** A plugin installed inside Claude Code never calls VibeDoc: the skills step re-checks this often until it's done. */
const SKILLS_POLL_MS = 10_000

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
  const [skills, setSkills] = useState<SkillsStatus | null>(null)
  const [agent, setAgent] = useState<ConnectAgent>("claude-code")
  const claude = agent === "claude-code"
  const [failed, setFailed] = useState(false)

  const load = useCallback((signal?: { cancelled: boolean }) => {
    fetch(`/api/agent-connect${rootParam}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(d => { if (!signal?.cancelled) { setMcp(d?.mcp ?? null); setSkills(d?.skills ?? null); setFailed(false) } })
      .catch(e => {
        console.warn("[vibedoc] could not load the agent connection:", e)
        if (!signal?.cancelled) setFailed(true)
      })
  }, [rootParam])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    // The first tool call arrives as SSE agent_connected (AppContext re-dispatches every event on window)
    const onSse = (e: Event) => {
      const type = (e as CustomEvent).detail?.type
      if (type === "agent_connected" || type === "agent_connect") load(signal)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { signal.cancelled = true; window.removeEventListener("vibedoc:sse", onSse) }
  }, [load])

  // Skills: re-check on focus (back from the terminal) and every SKILLS_POLL_MS until installed
  const skillsDone = skills?.installed === true
  useEffect(() => {
    if (skillsDone || !claude) return
    const signal = { cancelled: false }
    const check = () => load(signal)
    const timer = setInterval(check, SKILLS_POLL_MS)
    window.addEventListener("focus", check)
    return () => { signal.cancelled = true; clearInterval(timer); window.removeEventListener("focus", check) }
  }, [load, skillsDone, claude])

  const done = mcp?.connected === true
  return (
    <section className="space-y-4" aria-labelledby="connect-agent-title">
      <div>
        <h2 id="connect-agent-title" className="text-xl font-semibold text-txt mb-1">{t("connect.title")}</h2>
        <p className="text-sm text-muted">{t("connect.hint")}</p>
      </div>

      <div role="radiogroup" aria-label={t("connect.agentPicker")} className="inline-flex flex-wrap rounded-lg border border-border p-0.5">
        {CONNECT_AGENTS.map(a => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={agent === a}
            onClick={() => setAgent(a)}
            className={cn("rounded-md px-3 py-1 text-sm", agent === a ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-txt")}
          >
            {a === "claude-code" ? "Claude Code" : a === "cursor" ? "Cursor" : t("connect.other")}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3" role="group" aria-labelledby="connect-step-mcp">
        <div className="flex items-start gap-3">
          <StepMark done={done} />
          <div className="min-w-0">
            <h3 id="connect-step-mcp" className="text-sm font-medium text-txt">{t("connect.stepMcp")}</h3>
            <p className="text-xs text-muted">{t("connect.stepMcpHint")}</p>
          </div>
        </div>

        {claude ? (
          <>
            <ClaudeMcpConnect url={url} />
            <div className="space-y-1">
              <div className="text-xs text-muted">{t("connect.runInProject")}</div>
              <CommandBlock command={claudeMcpAddCommand(url)} />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-muted">{agent === "cursor" ? t("connect.pasteCursor") : t("connect.pasteOther")}</div>
            <CommandBlock command={mcpServersConfig(url)} />
            {agent === "other" && (
              <>
                <div className="text-xs text-muted">{t("connect.otherUrl")}</div>
                <CommandBlock command={url} />
              </>
            )}
          </div>
        )}

        <p className={cn("text-sm", done ? "text-green-400" : "text-muted")} role="status">
          {failed
            ? t("connect.loadFailed")
            : done && mcp?.lastCall
              ? t("connect.connected", { agent: agentLabel(mcp.agent) ?? t("connect.someAgent"), ago: timeAgo(mcp.lastCall) })
              : t("connect.waiting", { agent: claude ? "Claude Code" : agent === "cursor" ? "Cursor" : t("connect.yourAgent") })}
        </p>
      </div>

      {claude && <div className="rounded-lg border border-border p-4 space-y-3" role="group" aria-labelledby="connect-step-skills">
        <div className="flex items-start gap-3">
          <StepMark done={skillsDone} />
          <div className="min-w-0">
            <h3 id="connect-step-skills" className="text-sm font-medium text-txt">{t("connect.stepSkills")}</h3>
            <p className="text-xs text-muted">{t("connect.stepSkillsHint")}</p>
          </div>
        </div>
        {skillsDone ? (
          <div className="space-y-1" role="status">
            <p className="text-sm text-green-400">{t("connect.skillsInstalled")}</p>
            <div className="text-xs text-muted">{t("connect.tryNext")}</div>
            <CommandBlock command="/vibedoc:roadmap" />
          </div>
        ) : (
          <SkillsInstall status={skills} onDone={() => load()} />
        )}
      </div>}
    </section>
  )
}

/** Install the vibedoc plugin (S3) after a confirm; until then, the commands to run by hand. */
function SkillsInstall({ status, onDone }: { status: SkillsStatus | null; onDone: () => void }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ConnectResult | null>(null)

  const run = async () => {
    setConfirm(false)
    setRunning(true)
    const r = await runStep(rootParam, { step: "skills" })
    setResult(r)
    setRunning(false)
    if (r.ok) onDone()
  }

  return (
    <div className="space-y-2">
      <RunButton running={running} onClick={() => setConfirm(true)} label={t("connect.installSkills")} />
      {result ? <RunResult result={result} /> : (status?.error || status?.missing) && (
        <RunResult result={{ ok: false, missing: status.missing, exists: false, output: "", error: status.error }} />
      )}
      <div className="space-y-1">
        <div className="text-xs text-muted">{t("connect.orRunInClaude")}</div>
        {pluginInstallCommands().map(c => <CommandBlock key={c} command={c} />)}
      </div>
      {confirm && (
        <ConfirmDialog
          title={t("connect.confirmSkillsTitle")}
          note={t("connect.skillsNote")}
          commands={pluginInstallCommands()}
          confirmLabel={t("connect.confirm")}
          onConfirm={run}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  )
}

interface ConnectResult { ok: boolean; missing: boolean; exists: boolean; output: string; error: string | null }

/** POST one confirmed step to /api/agent-connect; a network or server failure comes back as a failed result. */
async function runStep(rootParam: string, body: object): Promise<ConnectResult> {
  try {
    const res = await fetch(`/api/agent-connect${rootParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => null)
    return {
      ok: res.ok && d?.ok === true, missing: d?.missing === true, exists: d?.exists === true,
      output: d?.output ?? "", error: d?.error ?? (res.ok ? null : String(res.status)),
    }
  } catch (e) {
    return { ok: false, missing: false, exists: false, output: "", error: (e as Error).message }
  }
}

/** One-click `claude mcp add` (S1): nothing runs until the user confirms the exact command; the result names what changed. */
function ClaudeMcpConnect({ url }: { url: string }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [confirm, setConfirm] = useState<"add" | "replace" | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ConnectResult | null>(null)

  const run = async (replace: boolean) => {
    setConfirm(null)
    setRunning(true)
    setResult(await runStep(rootParam, { step: "mcp", url, replace }))
    setRunning(false)
  }

  return (
    <div className="space-y-2">
      <RunButton running={running} onClick={() => setConfirm("add")} label={t("connect.connectClaude")} />
      {result && (
        <RunResult result={result} existsText={t("connect.alreadyExists")}>
          {result.exists && (
            <button type="button" onClick={() => setConfirm("replace")} className="rounded-lg border border-border px-3 py-1 text-sm text-txt hover:bg-surface2">
              {t("connect.replace")}
            </button>
          )}
        </RunResult>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "replace" ? t("connect.confirmReplaceTitle") : t("connect.confirmTitle")}
          note={t("connect.mcpNote")}
          commands={confirm === "replace" ? [claudeMcpRemoveCommand(), claudeMcpAddCommand(url)] : [claudeMcpAddCommand(url)]}
          confirmLabel={confirm === "replace" ? t("connect.confirmReplace") : t("connect.confirm")}
          onConfirm={() => run(confirm === "replace")}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function RunButton({ running, onClick, label }: { running: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={running}
      className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
    >
      {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  )
}

/** What the CLI said: the change on success; on failure the real error, then the fix (children, or run it yourself). */
function RunResult({ result, existsText, children }: { result: ConnectResult; existsText?: string; children?: React.ReactNode }) {
  const { t } = useT()
  const out = "whitespace-pre-wrap break-all rounded bg-surface2 p-2 font-mono text-xs text-txt"
  if (result.ok) {
    return (
      <div className="space-y-1 text-sm text-green-400" role="status">
        <div>{t("connect.changed")}</div>
        {result.output && <pre className={out}>{result.output}</pre>}
      </div>
    )
  }
  return (
    <div className="space-y-1 text-sm" role="alert">
      <div className="text-amber-400">
        {result.missing ? t("connect.claudeMissing") : result.exists && existsText ? existsText : t("connect.claudeError")}
      </div>
      {!result.missing && result.error && <pre className={out}>{result.error}</pre>}
      {children ?? <div className="text-xs text-muted">{t("connect.runYourself")}</div>}
    </div>
  )
}

/** Shows the exact commands and where they run; nothing runs until Confirm. */
function ConfirmDialog({ title, note, commands, confirmLabel, onConfirm, onClose }: {
  title: string; note: string; commands: string[]; confirmLabel: string; onConfirm: () => void; onClose: () => void
}) {
  const { activeProject } = useApp()
  const { t } = useT()
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg space-y-3">
        <DialogTitle className="text-sm font-semibold text-txt">{title}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{t("connect.confirmBody", { root: activeProject })} {note}</DialogDescription>
        {commands.map(c => <CommandBlock key={c} command={c} />)}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-txt">
            {t("connect.cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90">
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-txt">{command}</code>
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
