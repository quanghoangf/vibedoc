"use client"

import { useEffect, useMemo, useState } from "react"
import { useApp } from "@/context/AppContext"
import { applyEdits, lineDiff, type DiffLine, type TextEdit } from "@/lib/diff"
import { cn } from "@/lib/utils"

export type ProposalStatus = "pending" | "accepted" | "rejected"

export interface Proposal {
  id: string
  path: string
  edits: TextEdit[]
  summary?: string
  status: ProposalStatus
}

const CONTEXT = 2

// Keep changed lines plus CONTEXT lines around them; collapse the rest into a count.
function visibleHunks(lines: DiffLine[]): (DiffLine | number)[] {
  const keep = lines.map(() => false)
  lines.forEach((l, i) => {
    if (l.op === " ") return
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(lines.length - 1, i + CONTEXT); k++) keep[k] = true
  })
  const out: (DiffLine | number)[] = []
  lines.forEach((l, i) => {
    if (keep[i]) out.push(l)
    else if (typeof out[out.length - 1] === "number") out[out.length - 1] = (out[out.length - 1] as number) + 1
    else out.push(1)
  })
  return out
}

export function ProposalCard({ proposal, onResolve }: { proposal: Proposal; onResolve: (status: ProposalStatus) => void }) {
  const { rootParam, openDoc } = useApp()
  const [before, setBefore] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/docs${rootParam}&read=${encodeURIComponent(proposal.path)}`)
      .then((r) => (r.ok ? r.json() : null))
      // readDoc falls back to fuzzy matching; a different path means this doc doesn't exist yet
      .then((d) => setBefore(d?.path === proposal.path.replace(/^\.\//, "") && typeof d.content === "string" ? d.content : ""))
      .catch(() => setBefore(""))
  }, [proposal.path, rootParam])

  const applied = useMemo(() => (before === null ? null : applyEdits(before, proposal.edits)), [before, proposal.edits])
  const stale = applied !== null && "error" in applied ? applied.error : null
  const hunks = useMemo(
    () => (before === null || !applied || "error" in applied ? [] : visibleHunks(lineDiff(before, applied.content))),
    [before, applied],
  )
  const added = hunks.filter((h) => typeof h !== "number" && h.op === "+").length
  const removed = hunks.filter((h) => typeof h !== "number" && h.op === "-").length

  async function accept() {
    setSaving(true)
    setError(null)
    try {
      // Server re-applies the edits to the file as it is now, so unrelated changes since the proposal survive
      const res = await fetch(`/api/docs${rootParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: proposal.path, edits: proposal.edits, actor: "ai" }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Save failed")
      onResolve("accepted")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-surface2 border-b border-border">
        <button onClick={() => openDoc(proposal.path)} className="text-xs font-mono text-accent truncate hover:underline" title={proposal.path}>
          {proposal.path}
        </button>
        <span className="text-[10px] font-mono text-teal-400">+{added}</span>
        <span className="text-[10px] font-mono text-red-400">-{removed}</span>
      </div>
      {proposal.summary && <div className="px-2 py-1 text-xs text-muted border-b border-border">{proposal.summary}</div>}

      <div className="max-h-72 overflow-auto text-[11px] font-mono leading-5">
        {before === null && <div className="px-2 py-1 text-muted">Loading diff…</div>}
        {stale && <div className="px-2 py-1 text-red-400">Doc changed since this proposal ({stale}). Ask the agent to propose again.</div>}
        {before !== null && !stale && hunks.length === 0 && <div className="px-2 py-1 text-muted">No changes</div>}
        {hunks.map((h, i) =>
          typeof h === "number" ? (
            <div key={i} className="px-2 text-muted bg-surface2/50">⋯ {h} unchanged line{h > 1 ? "s" : ""}</div>
          ) : (
            <div
              key={i}
              className={cn(
                "px-2 whitespace-pre-wrap break-words",
                h.op === "+" && "bg-teal-500/10 text-teal-300",
                h.op === "-" && "bg-red-500/10 text-red-300 line-through decoration-red-400/40",
              )}
            >
              {h.op}{" "}{h.text || " "}
            </div>
          ),
        )}
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border">
        {proposal.status === "pending" ? (
          <>
            <button
              onClick={accept}
              disabled={saving || before === null || !!stale}
              className="text-xs px-2 py-0.5 rounded-sm bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {saving ? "Applying…" : "Accept"}
            </button>
            <button onClick={() => onResolve("rejected")} disabled={saving} className="text-xs px-2 py-0.5 rounded-sm text-muted hover:text-txt">
              Reject
            </button>
          </>
        ) : (
          <span className={cn("text-xs", proposal.status === "accepted" ? "text-teal-400" : "text-muted")}>
            {proposal.status === "accepted" ? "✓ Applied" : "Rejected"}
          </span>
        )}
        {error && <span className="text-xs text-red-400 truncate">{error}</span>}
      </div>
    </div>
  )
}
