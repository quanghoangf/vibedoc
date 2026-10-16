"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Archive, ChevronDown, ChevronRight, FolderOpen, FolderPlus, GitBranch, ScanSearch, TextCursorInput } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { PROJECT_GRID, ProjectRow, type ProjectWithCounts } from "@/components/projects/ProjectRow"
import { AddProjectDialog, chooseAndAddFolder, type AddedProject, type AddMode } from "@/components/projects/AddProjectDialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { GroupSection } from "@/components/projects/GroupSection"
import { PortfolioView } from "@/components/projects/PortfolioRow"
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
  return (
    <Suspense>
      <ProjectsView />
    </Suspense>
  )
}

/** `?view=portfolio` (R106 T549) shows the Portfolio; anything else is the List. */
function ViewSwitch({ portfolio }: { portfolio: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const go = (view: "list" | "portfolio") => {
    const q = new URLSearchParams(params.toString())
    if (view === "portfolio") q.set("view", "portfolio")
    else q.delete("view")
    router.replace(q.size ? `${pathname}?${q}` : pathname)
  }
  const tab = (view: "list" | "portfolio", on: boolean) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => go(view)}
      className={`h-7 rounded-[5px] px-3 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-bg text-txt shadow-[0_1px_2px_rgb(0_0_0/0.18)] ring-1 ring-border2" : "text-muted hover:text-txt"}`}
    >
      {t(view === "list" ? "projects.viewList" : "projects.viewPortfolio")}
    </button>
  )
  return (
    <div role="group" aria-label={t("projects.viewsLabel")} className="inline-flex gap-0.5 rounded-md bg-surface2 p-0.5">
      {tab("list", !portfolio)}
      {tab("portfolio", portfolio)}
    </div>
  )
}

function ProjectsView() {
  const searchParams = useSearchParams()
  const portfolio = searchParams.get("view") === "portfolio"
  const { projects: hubProjects, activeProject, onProjectChange, demo, playground } = useApp()
  const { t, tn } = useT()
  const router = useRouter()
  // `?add=path|scan|clone` (the switcher's fallback when there is no OS folder picker) opens that dialog
  const [adding, setAdding] = useState<AddMode | null>(() => {
    const a = searchParams.get("add")
    return a === "path" || a === "scan" || a === "clone" ? a : null
  })
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

  // R101: the new rows show up with their counts after a reload of the list
  const added = (projects: AddedProject[]) => {
    setAdding(null)
    const n = projects.filter((p) => p.added).length
    toast(n === 0 && projects.length === 1 ? t("projects.alreadyInHub", { name: projects[0].name }) : tn("projects.added", n))
    load()
  }

  // Finder first (Add project → Choose a folder…); no picker on this machine → the typed-path dialog
  const choose = async () => {
    try {
      const res = await chooseAndAddFolder(t("projects.pickPrompt"), t("projects.pickBusy"))
      if (res === "unsupported") setAdding("path")
      else if (res) added(res)
    } catch (e) {
      toast(t("projects.addFailed", { error: (e as Error).message }))
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

  const summary = list
    ? [tn("projects.countProjects", active.length), archived.length > 0 && t("projects.countArchived", { n: archived.length })].filter(Boolean).join(" · ")
    : null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">{t("projects.title")}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">{t("projects.lead")}</p>
        </div>
        {!demo && !playground && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9"><FolderPlus />{t("projects.add")}<ChevronDown className="opacity-70" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-1">
            {([
              ["choose", FolderOpen, "projects.addChoose", "projects.addChooseHint"],
              ["path", TextCursorInput, "projects.addFromPath", "projects.addFromPathHint"],
              ["scan", ScanSearch, "projects.addScan", "projects.addScanHint"],
              ["clone", GitBranch, "projects.addClone", "projects.addCloneHint"],
            ] as const).map(([mode, Icon, label, hint]) => (
              <DropdownMenuItem key={mode} onSelect={() => (mode === "choose" ? choose() : setAdding(mode))} className="items-start gap-3 py-2">
                <Icon className="mt-0.5 text-muted" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm text-txt">{t(label)}</span>
                  <span className="text-xs text-muted">{t(hint)}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>}
      </header>
      {/* a clone opens through `/`: the welcome for a project with no docs or roadmap, else its board (R082) */}
      {adding && <AddProjectDialog key={adding} mode={adding} onClose={() => setAdding(null)} onAdded={added} onCloned={(p) => { setAdding(null); router.push(`/?project=${encodeURIComponent(p.id)}`) }} />}

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch portfolio={portfolio} />
        {!portfolio && summary && <p className="text-xs text-muted tabular-nums">{summary}</p>}
      </div>
      {portfolio && <PortfolioView />}

      {!portfolio && <>
      {error && <p role="alert" className="text-sm text-danger">{t("projects.loadError", { error })}</p>}
      {!list && !error && <p className="text-sm text-muted">{t("projects.loading")}</p>}

      {list && active.length === 0 && (
        <EmptyState icon={<Archive className="size-6" />} message={t("projects.allArchived")} lead={t("projects.allArchivedLead")} />
      )}
      {active.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div aria-hidden className={`hidden border-b border-border px-3 py-2 font-mono text-[10px] font-medium tracking-[0.06em] text-muted uppercase ${PROJECT_GRID}`}>
            <span>{t("projects.colProject")}</span>
            <span className="text-right">{t("projects.colOpen")}</span>
            <span className="text-right">{t("projects.colNeeds")}</span>
            <span className="text-right">{t("projects.colOpened")}</span>
            <span />
          </div>
          <ul className="divide-y divide-border">{active.map(row)}</ul>
        </div>
      )}

      {archived.length > 0 && (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm text-muted outline-none select-none hover:text-txt focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden" aria-label={t("projects.showArchived")}>
            <ChevronRight aria-hidden className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
            {t("projects.archived", { n: archived.length })}
          </summary>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface/60 opacity-80">{archived.map(row)}</ul>
        </details>
      )}

      {list && <GroupSection projects={list} />}
      </>}
    </div>
  )
}
