"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Inbox } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { toast, undoToast } from "@/components/ui/toast"
import { InboxRow, KIND_LABEL, canSendBackFailed } from "@/components/inbox/InboxRow"
import { useInbox } from "@/components/inbox/use-inbox"
import type { InboxItem, InboxKind } from "@/lib/inbox"
import type { ProjectGroup } from "@/lib/groups"
import { useListKeys } from "@/components/shared/use-list-keys"

// `project` and `group` already mean the open project / group view in the app's URL (AppContext), so the filters use their own keys
const FILTER_KEYS = { repo: "repo", group: "repo_group", kind: "kind" } as const
type Filters = { repo: string; group: string; kind: string }

const selectClass = "h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-xs text-txt hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent sm:max-w-48 sm:flex-none"

/** Cross-project inbox (R105 T547): everything waiting on the user in every project, filterable, reviews decided inline. */
export default function InboxPage() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  )
}

function InboxView() {
  const params = useSearchParams()
  const { projects, demo } = useApp()
  const { t } = useT()
  const [filters, setFilters] = useState<Filters>(() => ({
    repo: params.get(FILTER_KEYS.repo) ?? "", group: params.get(FILTER_KEYS.group) ?? "", kind: params.get(FILTER_KEYS.kind) ?? "",
  }))
  const query = new URLSearchParams({ ...(filters.repo && { project: filters.repo }), ...(filters.group && { group: filters.group }) }).toString()
  const { items, error, reload, setItems } = useInbox(query ? `?${query}` : "")
  const [groups, setGroups] = useState<ProjectGroup[]>([])

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((g) => setGroups(Array.isArray(g) ? g : []), (e) => console.warn("[vibedoc] inbox groups:", e))
  }, [])

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    const url = new URL(window.location.href)
    for (const k of Object.keys(FILTER_KEYS) as (keyof Filters)[]) {
      if (next[k]) url.searchParams.set(FILTER_KEYS[k], next[k])
      else url.searchParams.delete(FILTER_KEYS[k])
    }
    window.history.replaceState(window.history.state, "", url)
  }
  const clear = () => (["repo", "group", "kind"] as const).forEach((k) => filters[k] && setFilter(k, ""))

  const shown = (items ?? []).filter((i) => !filters.kind || i.kind === filters.kind)
  const filtered = !!(filters.repo || filters.group || filters.kind)

  const list = useRef<HTMLUListElement>(null)
  const [focus, setFocus] = useState(-1)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const keyOf = (i: InboxItem) => `${i.project.id}/${i.id}`

  // Optimistic: the row leaves at once; a refusal says why and brings it back. Undo puts the task file back as it was.
  const decide = async (item: InboxItem, action: "approve" | "send-back", note = "") => {
    setNoteFor(null)
    setItems((prev) => prev?.filter((i) => keyOf(i) !== keyOf(item)) ?? prev)
    const vars = { id: item.id, project: item.project.name }
    const root = item.project.root ? `?root=${encodeURIComponent(item.project.root)}` : ""
    try {
      const res = await fetch(`/api/tasks/review${root}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, action, note }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      // Closure: what the approve did for its epic, from the tally the inbox already has
      const message = action === "approve"
        ? item.epic ? t("inbox.approvedEpic", { id: item.id, epic: item.epic.id, done: item.epic.done + 1, total: item.epic.total }) : t("inbox.approved", vars)
        : t("inbox.sentBack", vars)
      undoToast(message, async () => {
        const undo = await fetch(`/api/tasks/review/undo${root}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data?.undo ?? {}),
        })
        const out = await undo.json().catch(() => null)
        if (!undo.ok) throw new Error(out?.error ?? `HTTP ${undo.status}`)
        void reload()
      })
    } catch (e) {
      toast(t("inbox.failed", { ...vars, error: (e as Error).message }))
    }
    void reload()
  }

  const live = projects.filter((p) => !p.archived && !p.missing)
  const at = Math.min(focus, shown.length - 1)
  const canDecide = (i: InboxItem | undefined): i is InboxItem => !!i && i.kind === "review" && !demo
  // s also sends back a failed run on a task in review or done; a never approves one
  const canSendBack = (i: InboxItem | undefined): i is InboxItem => !!i && !demo && (i.kind === "review" || canSendBackFailed(i))

  // j/k (↓/↑ in the list) move the row and Enter opens it (useListKeys, like the board and chats); a approves a review, s opens
  // the send-back note (a review, or a failed run on a task in review or done). a / s belong to this page even with nothing to decide, so they never jump away by surprise.
  useListKeys(list, "[data-inbox-row] > div > a", {
    a: () => { const row = shown[at]; if (canDecide(row)) void decide(row, "approve") },
    s: () => { const row = shown[at]; if (canSendBack(row)) setNoteFor(keyOf(row)) },
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-4 border-b border-border pb-5">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">{t("inbox.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("inbox.lead")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select aria-label={t("inbox.filterProject")} value={filters.repo} onChange={(e) => setFilter("repo", e.target.value)} className={selectClass}>
            <option value="">{t("inbox.allProjects")}</option>
            {live.map((p) => <option key={p.id} value={p.id} data-user-content>{p.name}</option>)}
          </select>
          {groups.length > 0 && (
            <select aria-label={t("inbox.filterGroup")} value={filters.group} onChange={(e) => setFilter("group", e.target.value)} className={selectClass}>
              <option value="">{t("inbox.allGroups")}</option>
              {groups.map((g) => <option key={g.slug} value={g.slug} data-user-content>{g.name}</option>)}
            </select>
          )}
          <select aria-label={t("inbox.filterKind")} value={filters.kind} onChange={(e) => setFilter("kind", e.target.value)} className={selectClass}>
            <option value="">{t("inbox.allKinds")}</option>
            {(Object.keys(KIND_LABEL) as InboxKind[]).map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
          </select>
        </div>
      </header>

      {error && <p role="alert" className="text-sm text-danger">{t("inbox.loadError", { error })}</p>}
      {!items && !error && <p className="text-sm text-muted">{t("inbox.loading")}</p>}

      {items && shown.length === 0 && (filtered
        ? <EmptyState icon={<Inbox className="size-6" />} message={t("inbox.emptyFiltered")} action={<Button size="sm" variant="outline" onClick={clear}>{t("inbox.clearFilters")}</Button>} />
        : <EmptyState icon={<Inbox className="size-6" />} message={t("inbox.emptyMessage")} lead={t("inbox.emptyLead")} />)}
      {shown.length > 0 && (
        <ul ref={list} aria-label={t("inbox.title")} className="divide-y divide-border">
          {shown.map((item, i) => (
            <InboxRow
              key={keyOf(item)}
              item={item}
              focused={i === at}
              onFocus={() => setFocus(i)}
              onApprove={demo ? undefined : () => decide(item, "approve")}
              onSendBack={demo ? undefined : (note) => decide(item, "send-back", note)}
              noteOpen={noteFor === keyOf(item)}
              onNoteOpen={(open) => setNoteFor(open ? keyOf(item) : null)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
