"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/context/AppContext"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { cn } from "@/lib/utils"
import type { Plan, PlanEpic, PlanTask } from "@/lib/plan"

export type PlanStatus = "pending" | "accepted" | "rejected"
export interface PlanCreated { key: string; id: string; file: string }

export interface PlanProposal {
  id: string
  plan: Plan
  status: PlanStatus
  created?: PlanCreated[]
}

export function PlanCard({ proposal, onResolve }: {
  proposal: PlanProposal
  onResolve: (status: PlanStatus, created: PlanCreated[], unchecked: string[]) => void
}) {
  const { rootParam, openDoc } = useApp()
  const plan = proposal.plan
  const tasks: PlanTask[] = plan.kind === "breakdown" ? plan.tasks : []
  const horizons = plan.kind === "roadmap" ? plan.horizons ?? [] : []
  const epics: PlanEpic[] = plan.kind === "roadmap" ? plan.epics ?? [] : []
  const epicId = plan.kind === "breakdown" ? (plan.epic ?? "").trim().toUpperCase() : ""
  const newEpic = plan.kind === "breakdown" ? plan.newEpic : undefined
  const [titles, setTitles] = useState<Map<string, string>>(new Map())
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/roadmap${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTitles(new Map((d?.items ?? []).map((i: { id: string; title: string }) => [i.id, i.title]))))
      .catch(() => setTitles(new Map()))
  }, [rootParam])

  const keys = plan.kind === "breakdown" ? tasks.map((t) => t.key) : [...horizons, ...epics].map((x) => x.key)
  const selected = keys.filter((k) => !unchecked.has(k))
  const pending = proposal.status === "pending"

  // Roadmap: a horizon toggles its epics; checking an epic re-checks its horizon (never an epic without its horizon).
  const epicsOf = (h: string) => epics.filter((e) => e.parent.trim() === h).map((e) => e.key)
  const horizonKeys = new Set(horizons.map((h) => h.key))
  function toggle(key: string) {
    setError(null)
    setUnchecked((prev) => {
      const next = new Set(prev)
      const on = next.has(key)
      const group = horizonKeys.has(key) ? [key, ...epicsOf(key)] : [key]
      for (const k of group) if (on) next.delete(k); else next.add(k)
      const parent = epics.find((e) => e.key === key)?.parent.trim()
      if (on && parent && horizonKeys.has(parent)) next.delete(parent)
      return next
    })
  }

  const row = (key: string, title: string, meta: string, body: string | undefined, indent = false) => (
    <PlanRow
      key={key} rowKey={key} title={title} meta={meta} body={body} indent={indent}
      checked={!unchecked.has(key)} disabled={!pending || saving} onToggle={() => toggle(key)}
      open={open === key} onOpen={() => setOpen(open === key ? null : key)}
    />
  )
  const outcome = (body: string) => body.trim().split("\n")[0] ?? ""
  // Existing horizons that the plan adds epics to, in first-use order.
  const existingParents = [...new Set(epics.map((e) => e.parent.trim()).filter((p) => !horizonKeys.has(p)))]

  async function accept() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/plan/apply${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, selected }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `Apply failed (${res.status})`)
      onResolve("accepted", data?.created ?? [], [...unchecked])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-surface2 border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Plan</span>
        {plan.kind === "breakdown" ? (
          <>
            {epicId ? (
              <>
                <span className="text-xs font-mono text-accent">{epicId}</span>
                <span className="text-xs text-txt truncate">{titles.get(epicId) ?? ""}</span>
              </>
            ) : newEpic ? (
              <span className="text-xs text-txt truncate">
                New epic: {newEpic.title}
                <span className="text-muted"> (under {newEpic.parent.trim().toUpperCase()} {titles.get(newEpic.parent.trim().toUpperCase()) ?? ""})</span>
              </span>
            ) : (
              <span className="text-xs text-muted">No epic</span>
            )}
            <span className="ml-auto text-[10px] font-mono text-muted">{tasks.length} tasks</span>
          </>
        ) : (
          <>
            <span className="text-xs text-txt">Roadmap</span>
            <span className="ml-auto text-[10px] font-mono text-muted">
              {horizons.length ? `${horizons.length} horizons · ` : ""}{epics.length} epics
            </span>
          </>
        )}
      </div>

      <ul className="max-h-80 overflow-auto">
        {tasks.map((t) => row(
          t.key, t.title,
          [t.size, t.dependsOn?.length ? `after ${t.dependsOn.join(", ")}` : null, t.due ? `due ${t.due}` : null, t.covers?.length ? `covers ${t.covers.join(", ")}` : null].filter(Boolean).join(" · "),
          t.body,
        ))}
        {horizons.map((h) => [
          row(h.key, h.title, "new horizon", h.body),
          ...epics.filter((e) => e.parent.trim() === h.key).map((e) => row(e.key, e.title, outcome(e.body), e.body, true)),
        ])}
        {existingParents.map((p) => [
          <li key={`parent-${p}`} className="px-2 py-1.5 border-b border-border text-xs text-muted">
            <span className="font-mono text-accent mr-1">{p.toUpperCase()}</span>{titles.get(p.toUpperCase()) ?? ""}
          </li>,
          ...epics.filter((e) => e.parent.trim() === p).map((e) => row(e.key, e.title, outcome(e.body), e.body, true)),
        ])}
      </ul>

      {error && <div className="px-2 py-1 text-xs text-red-400 whitespace-pre-wrap border-t border-border">{error}</div>}

      <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border">
        {pending ? (
          <>
            <button
              onClick={accept}
              disabled={saving || selected.length === 0}
              className="text-xs px-2 py-0.5 rounded-sm bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {saving ? "Creating…" : `Accept (${selected.length})`}
            </button>
            <button onClick={() => onResolve("rejected", [], [])} disabled={saving} className="text-xs px-2 py-0.5 rounded-sm text-muted hover:text-txt">
              Reject
            </button>
          </>
        ) : proposal.status === "accepted" ? (
          <span className="text-xs text-teal-400">
            ✓ Created{" "}
            {(proposal.created ?? []).map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <button onClick={() => openDoc(c.file)} className="font-mono hover:underline">{c.id}</button>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted">Rejected</span>
        )}
      </div>
    </div>
  )
}

function PlanRow({ rowKey, title, meta, body, indent, checked, disabled, onToggle, open, onOpen }: {
  rowKey: string
  title: string
  meta: string
  body?: string
  indent: boolean
  checked: boolean
  disabled: boolean
  onToggle: () => void
  open: boolean
  onOpen: () => void
}) {
  return (
    <li data-plan-row={rowKey} className="border-b border-border last:border-b-0">
      <div className={cn("flex items-start gap-2 px-2 py-1.5", indent && "pl-6")}>
        <input
          type="checkbox"
          aria-label={`Include ${title}`}
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="mt-0.5 accent-accent"
        />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className={cn("text-xs text-txt", !checked && "line-through text-muted")}>
            <span className="font-mono text-muted mr-1">{rowKey}</span>{title}
          </div>
          {meta && <div className="text-[10px] font-mono text-muted truncate">{meta}</div>}
        </button>
      </div>
      {open && body && (
        <div className="px-3 pb-2 border-t border-border bg-surface2/40">
          <MarkdownRenderer content={body} className="text-xs" />
        </div>
      )}
    </li>
  )
}
