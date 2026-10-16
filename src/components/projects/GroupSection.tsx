"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast, undoToast } from "@/components/ui/toast"
import { useT } from "@/context/LanguageContext"
import type { ProjectGroup } from "@/lib/groups"
import type { Project } from "@/types"

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

async function fetchGroups(): Promise<ProjectGroup[]> {
  try {
    const data = await (await fetch("/api/groups")).json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const input = "h-8 rounded-md border border-border bg-bg px-2 text-sm text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
const iconButton = "size-8 text-muted hover:text-txt"

/** Groups on All projects (R102 T538): repos that make one product. Membership is saved in each member repo. */
export function GroupSection({ projects }: { projects: Project[] }) {
  const { t } = useT()
  const [groups, setGroups] = useState<ProjectGroup[] | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => fetchGroups().then(setGroups), [])

  useEffect(() => {
    fetchGroups().then(setGroups)
    const onSse = (e: Event) => { if ((e as CustomEvent).detail?.type === "projects_updated") load() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const run = async (name: string, path: string, body: unknown) => {
    try {
      const data = await post(path, body)
      await load()
      return data
    } catch (e) {
      toast(t("projects.groupFailed", { name, error: (e as Error).message }))
      await load()
      return null
    }
  }

  const remove = async (g: ProjectGroup) => {
    setGroups((prev) => prev?.filter((x) => x.slug !== g.slug) ?? prev)
    const data = await run(g.name, "/api/groups/delete", { slug: g.slug })
    if (data) undoToast(t("projects.groupDeleted", { name: g.name }), async () => {
      await run(g.name, "/api/groups/create", { name: g.name, slug: g.slug, members: g.members.map((m) => m.id) })
    })
  }

  const usable = projects.filter((p) => !p.archived && !p.missing)

  return (
    <section aria-labelledby="groups-heading" className="mt-10">
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <h2 id="groups-heading" className="text-base font-semibold text-txt">{t("projects.groups")}</h2>
          <p className="mt-1 text-sm text-muted">{t("projects.groupsLead")}</p>
        </div>
        {!creating && usable.length > 0 && (
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setCreating(true)}><Plus />{t("projects.newGroup")}</Button>
        )}
      </div>

      {creating && (
        <NewGroupForm
          projects={usable}
          onCancel={() => setCreating(false)}
          onCreate={async (name, members) => {
            const data = await run(name, "/api/groups/create", { name, members })
            if (data) setCreating(false)
          }}
        />
      )}

      {groups && groups.length === 0 && !creating && <p className="py-3 text-sm text-muted">{t("projects.noGroups")}</p>}
      {groups && groups.length > 0 && (
        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <GroupRow
              key={g.slug}
              group={g}
              candidates={usable.filter((p) => !g.members.some((m) => m.id === p.id))}
              onRename={(name) => run(g.name, "/api/groups/rename", { slug: g.slug, name })}
              onAdd={(id) => run(g.name, "/api/groups/members", { slug: g.slug, add: [id] })}
              onRemoveMember={(id) => run(g.name, "/api/groups/members", { slug: g.slug, remove: [id] })}
              onDelete={() => remove(g)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function NewGroupForm({ projects, onCreate, onCancel }: { projects: Project[]; onCreate: (name: string, members: string[]) => void; onCancel: () => void }) {
  const { t } = useT()
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const ready = name.trim() !== "" && picked.length > 0
  return (
    <form
      aria-label={t("projects.newGroup")}
      className="mb-4 flex flex-col gap-3 rounded-md border border-border p-3"
      onSubmit={(e) => { e.preventDefault(); if (ready) onCreate(name.trim(), picked) }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("projects.groupName")}
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projects.groupNamePlaceholder")} className={`${input} w-64`} data-user-content />
      </label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="mb-1 text-xs text-muted">{t("projects.groupMembers")}</legend>
        {projects.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5 text-sm text-txt">
            <input
              type="checkbox"
              checked={picked.includes(p.id)}
              onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))}
              className="accent-accent"
            />
            <span data-user-content>{p.name}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" className="h-8" disabled={!ready}>{t("projects.createGroup")}</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>{t("projects.cancel")}</Button>
      </div>
    </form>
  )
}

interface GroupRowProps {
  group: ProjectGroup
  /** Hub projects not in this group yet (not archived, folder present) */
  candidates: Project[]
  onRename: (name: string) => void
  onAdd: (id: string) => void
  onRemoveMember: (id: string) => void
  onDelete: () => void
}

function GroupRow({ group: g, candidates, onRename, onAdd, onRemoveMember, onDelete }: GroupRowProps) {
  const { t } = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(g.name)
  const save = () => {
    const name = draft.trim()
    setEditing(false)
    if (name && name !== g.name) onRename(name)
  }
  return (
    <li data-group-row={g.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        {editing ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(g.name) } }}
              aria-label={t("projects.groupRenameLabel", { name: g.name })}
              className={`${input} w-56`}
              data-user-content
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">{t("projects.save")}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setDraft(g.name) }}>{t("projects.cancel")}</Button>
          </form>
        ) : (
          <span className="font-medium text-txt" data-user-content>{g.name}</span>
        )}
        <ul aria-label={t("projects.membersOf", { name: g.name })} className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {g.members.map((m) => (
            <li key={m.id} className="flex items-center gap-0.5 rounded-sm bg-surface2 py-0.5 pr-0.5 pl-2 text-xs text-txt">
              <span data-user-content>{m.name}</span>
              <button
                type="button"
                onClick={() => onRemoveMember(m.id)}
                aria-label={t("projects.removeMember", { project: m.name, name: g.name })}
                title={t("projects.removeMember", { project: m.name, name: g.name })}
                className="grid size-5 place-items-center rounded-sm text-muted hover:text-txt focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
          {candidates.length > 0 && (
            <li>
              <select
                value=""
                onChange={(e) => { if (e.target.value) onAdd(e.target.value) }}
                aria-label={t("projects.addMember", { name: g.name })}
                className="h-6 rounded-sm border border-border bg-bg px-1 text-xs text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">{t("projects.addMemberOption")}</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </li>
          )}
        </ul>
      </div>
      <div role="group" aria-label={t("projects.actionsFor", { name: g.name })} className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className={iconButton} title={t("projects.rename")} aria-label={t("projects.groupRename", { name: g.name })} onClick={() => { setDraft(g.name); setEditing(true) }}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" className={`${iconButton} hover:text-danger`} title={t("projects.groupDelete")} aria-label={t("projects.groupDeleteLabel", { name: g.name })} onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
