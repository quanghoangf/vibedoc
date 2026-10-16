"use client"

import { useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import { MAX_SCAN_RESULTS, type HubProject, type ScannedRepo } from "@/lib/hub"

export type AddMode = "path" | "scan" | "clone"
export type AddedProject = HubProject & { added: boolean }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as T
}

export const addRoots = (roots: string[]) =>
  call<{ projects: AddedProject[] }>("/api/projects/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roots }) })

export type PickResult = { path?: string; cancelled?: true; unsupported?: true; busy?: true }

/** Opens the OS folder picker on this machine (Finder on macOS); `unsupported` → the caller asks for a typed path. */
export const pickFolder = (prompt: string) =>
  call<PickResult>("/api/projects/pick-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })

/** Add project → Choose a folder…: Finder, then the hub. `"unsupported"` → open the typed-path dialog; null = cancelled. */
export async function chooseAndAddFolder(prompt: string, busyMessage: string): Promise<AddedProject[] | "unsupported" | null> {
  const res = await pickFolder(prompt)
  if (res.unsupported) return "unsupported"
  if (res.busy) throw new Error(busyMessage)
  if (!res.path) return null
  return (await addRoots([res.path])).projects
}

const field = "h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-xs text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"

/** All projects → Add project (R101): one folder by its path, scan a folder and tick the repos to add (T536), or clone (T537). */
export function AddProjectDialog({ mode, onClose, onAdded, onCloned }: {
  mode: AddMode
  onClose: () => void
  onAdded: (projects: AddedProject[]) => void
  /** T537: the clone is in the hub; the page opens it */
  onCloned: (project: HubProject) => void
}) {
  const { t, tn } = useT()
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repos, setRepos] = useState<ScannedRepo[] | null>(null)
  const [scannedDir, setScannedDir] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [parent, setParent] = useState("")
  const [progress, setProgress] = useState("")

  // T537: git's progress line while a clone runs (SSE `project_clone`)
  useEffect(() => {
    if (mode !== "clone") return
    const onSse = (e: Event) => {
      const msg = (e as CustomEvent).detail
      if (msg?.type === "project_clone" && typeof msg.payload?.line === "string") setProgress(msg.payload.line)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [mode])

  const [canBrowse, setCanBrowse] = useState(true)
  // Browse… fills a path field from the OS picker; no picker on this machine → the button goes away, typing still works
  const browse = (set: (path: string) => void) => run(async () => {
    const res = await pickFolder(t("projects.pickPrompt"))
    if (res.unsupported) setCanBrowse(false)
    else if (res.busy) throw new Error(t("projects.pickBusy"))
    else if (res.path) set(res.path)
  })
  const browseButton = (set: (path: string) => void) => canBrowse && (
    <Button type="button" size="sm" variant="secondary" className="h-9" disabled={busy} onClick={() => browse(set)}>
      <FolderOpen />{t("projects.browse")}
    </Button>
  )

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const addPath = () => run(async () => {
    const { projects } = await addRoots([input])
    onAdded(projects)
  })

  const scan = () => run(async () => {
    setRepos(null)
    setPicked(new Set())
    const res = await call<{ repos: ScannedRepo[] }>(`/api/projects/scan?dir=${encodeURIComponent(input)}`)
    setRepos(res.repos)
    setScannedDir(input.trim())
  })

  const addPicked = () => run(async () => {
    const { projects } = await addRoots([...picked])
    onAdded(projects)
  })

  const clone = () => run(async () => {
    setProgress("")
    try {
      const { project } = await call<{ project: HubProject }>("/api/projects/clone", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: input.trim(), parent }),
      })
      onCloned(project)
    } finally {
      setProgress("")
    }
  })
  const cancelClone = () => fetch("/api/projects/clone/cancel", { method: "POST" })

  if (mode === "clone") {
    return (
      <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose() }}>
        <DialogContent className="max-w-xl border-border bg-surface text-txt shadow-xl shadow-black/20">
          <DialogTitle className="text-sm font-semibold text-txt">{t("projects.cloneTitle")}</DialogTitle>
          <DialogDescription className="text-xs text-muted">{t("projects.cloneLead")}</DialogDescription>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (input.trim() && parent.trim()) clone() }}>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t("projects.cloneUrl")}
              <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://github.com/org/repo.git" disabled={busy} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t("projects.cloneParent")}
              <span className="flex items-center gap-2">
                <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder={t("projects.scanPlaceholder")} disabled={busy} className={field} />
                {browseButton(setParent)}
              </span>
            </label>
            {error && <p role="alert" className="text-xs text-danger">{t("projects.cloneFailed", { error })}</p>}
            {busy && <p role="status" className="truncate font-mono text-[11px] text-muted">{progress || t("projects.cloning")}</p>}
            <div className="flex justify-end gap-2">
              {busy
                ? <Button type="button" size="sm" variant="ghost" onClick={cancelClone}>{t("projects.cancel")}</Button>
                : <Button type="button" size="sm" variant="ghost" onClick={onClose}>{t("projects.cancel")}</Button>}
              <Button type="submit" size="sm" disabled={busy || !input.trim() || !parent.trim()}>{busy ? t("projects.cloning") : t("projects.clone")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  const fresh = repos?.filter((r) => !r.inHub) ?? []
  const toggle = (root: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(root)) next.delete(root)
    else next.add(root)
    return next
  })

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border bg-surface text-txt shadow-xl shadow-black/20">
        <DialogTitle className="text-sm font-semibold text-txt">{mode === "path" ? t("projects.addPathTitle") : t("projects.scanTitle")}</DialogTitle>
        <DialogDescription className="text-xs text-muted">{mode === "path" ? t("projects.addPathLead") : t("projects.scanLead")}</DialogDescription>

        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) (mode === "path" ? addPath : scan)() }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "path" ? t("projects.pathPlaceholder") : t("projects.scanPlaceholder")}
            aria-label={mode === "path" ? t("projects.pathLabel") : t("projects.scanLabel")}
            aria-invalid={!!error || undefined}
            className={field}
          />
          {browseButton(setInput)}
          <Button type="submit" size="sm" variant={mode === "path" ? "default" : "secondary"} className="h-9" disabled={busy || !input.trim()}>
            {mode === "path" ? t("projects.addOne") : busy && !repos ? t("projects.scanning") : t("projects.scan")}
          </Button>
        </form>
        {error && <p role="alert" className="text-xs text-danger">{t("projects.addFailed", { error })}</p>}

        {mode === "scan" && repos && (
          repos.length === 0 ? (
            <p className="text-sm text-muted">{t("projects.scanNone", { dir: scannedDir })}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{tn("projects.scanFound", repos.length, { fresh: fresh.length })}</span>
                {repos.length >= MAX_SCAN_RESULTS && <span>{t("projects.scanCapped", { n: MAX_SCAN_RESULTS })}</span>}
                {fresh.length > 0 && (
                  <button type="button" className="ml-auto text-accent hover:underline" onClick={() => setPicked(new Set(fresh.map((r) => r.root)))}>
                    {t("projects.selectAll")}
                  </button>
                )}
              </div>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border" data-scan-results>
                {repos.map((r) => (
                  <li key={r.root}>
                    <label className={cn("flex items-center gap-3 px-3 py-2 text-sm", r.inHub ? "text-muted" : "cursor-pointer hover:bg-surface2")}>
                      <input
                        type="checkbox"
                        className="size-3.5 accent-accent"
                        disabled={r.inHub}
                        checked={!r.inHub && picked.has(r.root)}
                        onChange={() => toggle(r.root)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" data-user-content>{r.name}</span>
                        <span className="block truncate font-mono text-[11px] text-muted" title={r.root} data-user-content>{r.root}</span>
                      </span>
                      {r.inHub && <span className="rounded-sm bg-surface2 px-1.5 py-0.5 text-[11px]">{t("projects.inHub")}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onClose}>{t("projects.cancel")}</Button>
                <Button type="button" size="sm" disabled={busy || picked.size === 0} onClick={addPicked}>
                  {tn("projects.addSelected", picked.size)}
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
