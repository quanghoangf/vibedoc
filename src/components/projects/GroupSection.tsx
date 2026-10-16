"use client"

import { useCallback, useEffect, useState } from "react"
import { Layers, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
    <section aria-labelledby="groups-heading" className="mt-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="groups-heading" className="text-[1.1rem] leading-snug font-semibold text-txt">{t("projects.groups")}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{t("projects.groupsLead")}</p>
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

      {groups && groups.length === 0 && !creating && (
        <p className="rounded-lg border border-dashed border-border2 px-4 py-5 text-sm text-muted">{t("projects.noGroups")}</p>
      )}
      {groups && groups.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
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
      className="mb-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
      onSubmit={(e) => { e.preventDefault(); if (ready) onCreate(name.trim(), picked) }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("projects.groupName")}
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projects.groupNamePlaceholder")} className={`${input} w-full max-w-64`} data-user-content />
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
        <Button type="submit" size="sm" className="h-8" disabled={!ready}>{t("projects.createGroup")}</Button>
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
    <li data-group-row={g.slug} className="flex items-start gap-3 px-3 py-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-border2 bg-surface2 text-muted">
        <Layers className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(g.name) } }}
              aria-label={t("projects.groupRenameLabel", { name: g.name })}
              className={`${input} w-full max-w-56 min-w-0`}
              data-user-content
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">{t("projects.save")}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setDraft(g.name) }}>{t("projects.cancel")}</Button>
          </form>
        ) : (
          <div className="flex h-8 items-center gap-2">
            <span className="truncate text-sm font-medium text-txt" data-user-content>{g.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">{g.members.length}</span>
          </div>
        )}
        <ul aria-label={t("projects.membersOf", { name: g.name })} className="mt-1 flex flex-wrap items-center gap-1.5">
          {g.members.map((m) => (
            <li key={m.id} className="flex h-6 items-center gap-0.5 rounded-md border border-border2 bg-surface2 pr-0.5 pl-2 text-xs text-txt">
              <span data-user-content>{m.name}</span>
              <button
                type="button"
                onClick={() => onRemoveMember(m.id)}
                aria-label={t("projects.removeMember", { project: m.name, name: g.name })}
                title={t("projects.removeMember", { project: m.name, name: g.name })}
                className="grid size-5 place-items-center rounded-sm text-muted transition-colors duration-150 hover:bg-bg hover:text-txt focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
          {candidates.length > 0 && (
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("projects.addMember", { name: g.name })}
                    className="flex h-6 items-center gap-1 rounded-md border border-dashed border-border2 px-2 text-xs text-muted transition-colors duration-150 hover:border-accent/50 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <Plus className="size-3" />{t("projects.addMemberShort")}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {candidates.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => onAdd(p.id)}><span className="truncate" data-user-content>{p.name}</span></DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}
        </ul>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8 shrink-0 text-muted hover:text-txt" aria-label={t("projects.moreFor", { name: g.name })} title={t("projects.more")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => { setDraft(g.name); setEditing(true) }} aria-label={t("projects.groupRename", { name: g.name })}>
            <Pencil />{t("projects.rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} aria-label={t("projects.groupDeleteLabel", { name: g.name })} className="text-danger focus:text-danger">
            <Trash2 />{t("projects.groupDelete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
