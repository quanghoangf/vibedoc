"use client"

import { useCallback, useEffect, useState } from "react"
import { Archive } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { ProjectRow, type ProjectWithCounts } from "@/components/projects/ProjectRow"
import { GroupSection } from "@/components/projects/GroupSection"
import { toast, undoToast } from "@/components/ui/toast"
import { switcherOrder } from "@/lib/hub"

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

async function fetchProjects(): Promise<ProjectWithCounts[]> {
  const res = await fetch("/api/projects?counts=1")
  const data = await res.json()
  if (!res.ok || !Array.isArray(data)) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

/** All projects (R099 T531): every project in the hub, what needs the user there, and pin / rename / archive / remove. */
export default function ProjectsPage() {
  const { projects: hubProjects, activeProject, onProjectChange } = useApp()
  const { t } = useT()
  const [list, setList] = useState<ProjectWithCounts[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => fetchProjects().then((data) => { setList(data); setError(null) }, (e: Error) => setError(e.message)), [])

  useEffect(() => {
    fetchProjects().then(setList, (e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    const onSse = (e: Event) => {
      const type = (e as CustomEvent).detail?.type
      if (type === "projects_updated" || type === "task_updated" || type === "task_created") load()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [load])

  const startedRoot = hubProjects[0]?.root

  // Optimistic: the row changes at once; a failed write reloads the hub and says why
  const patch = async (p: ProjectWithCounts, change: { name?: string; pinned?: boolean; archived?: boolean }) => {
    setList((prev) => prev?.map((x) => (x.id === p.id ? { ...x, ...change } : x)) ?? prev)
    try {
      await post("/api/projects/update", { id: p.id, patch: change })
    } catch (e) {
      toast(t("projects.failed", { name: p.name, error: (e as Error).message }))
      load()
    }
  }

  const remove = async (p: ProjectWithCounts) => {
    setList((prev) => prev?.filter((x) => x.id !== p.id) ?? prev)
    try {
      const { entry } = await post("/api/projects/remove", { id: p.id })
      undoToast(t("projects.removed", { name: p.name }), async () => {
        await post("/api/projects/restore", { entry })
        load()
      })
    } catch (e) {
      toast(t("projects.failed", { name: p.name, error: (e as Error).message }))
      load()
    }
  }

  // T532: the error comes back in words to the row; nothing is saved on a refusal
  const locate = async (p: ProjectWithCounts, root: string): Promise<string | null> => {
    try {
      await post("/api/projects/locate", { id: p.id, root })
      await load()
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  const active = list ? switcherOrder(list) : []
  const archived = list ? list.filter((p) => p.archived) : []
  const row = (p: ProjectWithCounts) => (
    <ProjectRow
      key={p.id}
      project={p}
      current={p.root === activeProject}
      started={p.root === startedRoot}
      onOpen={() => onProjectChange(p.id)}
      onPatch={(change) => patch(p, change)}
      onRemove={() => remove(p)}
      onLocate={(root) => locate(p, root)}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-8">
      <header className="mb-4 border-b border-border pb-5">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">{t("projects.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("projects.lead")}</p>
      </header>

      {error && <p role="alert" className="text-sm text-danger">{t("projects.loadError", { error })}</p>}
      {!list && !error && <p className="text-sm text-muted">{t("projects.loading")}</p>}

      {list && active.length === 0 && (
        <EmptyState icon={<Archive className="size-6" />} message={t("projects.allArchived")} lead={t("projects.allArchivedLead")} />
      )}
      {active.length > 0 && <ul className="divide-y divide-border">{active.map(row)}</ul>}

      {archived.length > 0 && (
        <details className="mt-6 group">
          <summary className="cursor-pointer select-none text-sm text-muted hover:text-txt" aria-label={t("projects.showArchived")}>
            {t("projects.archived", { n: archived.length })}
          </summary>
          <ul className="mt-2 divide-y divide-border opacity-80">{archived.map(row)}</ul>
        </details>
      )}

      {list && <GroupSection projects={list} />}
    </div>
  )
}
