"use client"

import { useState } from "react"
import { Archive, ArchiveRestore, FolderSearch, Pencil, Pin, PinOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useFormat, useT } from "@/context/LanguageContext"
import type { Project } from "@/types"
import type { ProjectCounts } from "@/lib/core"

export type ProjectWithCounts = Project & { counts: ProjectCounts | null }

interface ProjectRowProps {
  project: ProjectWithCounts
  current: boolean
  /** The configured root: VibeDoc was started there, the hub always keeps it */
  started: boolean
  onOpen: () => void
  onPatch: (patch: { name?: string; pinned?: boolean; archived?: boolean }) => void
  onRemove: () => void
  /** Locate (T532): the folder's new absolute path; resolves to an error message, or null when it worked */
  onLocate: (root: string) => Promise<string | null>
}

const iconButton = "size-8 text-muted hover:text-txt"

/** One project on All projects (T531): name, path, last opened, counts, and its actions. */
export function ProjectRow({ project: p, current, started, onOpen, onPatch, onRemove, onLocate }: ProjectRowProps) {
  const { t, tn } = useT()
  const f = useFormat()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(p.name)
  const [locating, setLocating] = useState(false)
  const [where, setWhere] = useState("")
  const [locateError, setLocateError] = useState<string | null>(null)

  const locate = async () => {
    const error = await onLocate(where.trim())
    setLocateError(error)
    if (!error) { setLocating(false); setWhere("") }
  }

  const save = () => {
    const name = draft.trim()
    setEditing(false)
    if (name && name !== p.name) onPatch({ name })
  }
  const removeBlocked = current ? t("projects.removeCurrent") : started ? t("projects.removeStarted") : null

  return (
    <li data-project-row={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex items-center gap-2">
          {p.pinned && <Pin aria-label={t("projects.pinned")} className="size-3.5 shrink-0 text-accent" />}
          {editing ? (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(p.name) } }}
                aria-label={t("projects.renameLabel", { name: p.name })}
                className="h-8 w-56 rounded-md border border-border bg-bg px-2 text-sm text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-user-content
              />
              <Button type="submit" size="sm" variant="secondary" className="h-8">{t("projects.save")}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setDraft(p.name) }}>{t("projects.cancel")}</Button>
            </form>
          ) : (
            <span className="truncate font-medium text-txt" data-user-content>{p.name}</span>
          )}
          {current && <span className="rounded-sm bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">{t("projects.current")}</span>}
          {p.missing && <span data-missing className="rounded-sm bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">{t("projects.missing")}</span>}
        </div>
        <div className={cn("mt-0.5 truncate font-mono text-[11px] text-muted", p.missing && "line-through")} title={p.root} data-user-content>{p.root}</div>
        {p.missing && !locating && <p className="mt-1 text-xs text-muted">{t("projects.missingHint")}</p>}
        {locating && (
          <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); locate() }}>
            <input
              autoFocus
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setLocating(false); setLocateError(null) } }}
              placeholder={t("projects.locatePlaceholder")}
              aria-label={t("projects.locateLabel", { name: p.name })}
              aria-invalid={!!locateError || undefined}
              aria-describedby={locateError ? `locate-error-${p.id}` : undefined}
              className="h-8 min-w-0 flex-1 basis-72 rounded-md border border-border bg-bg px-2 font-mono text-xs text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8" disabled={!where.trim()}>{t("projects.locate")}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setLocating(false); setLocateError(null) }}>{t("projects.cancel")}</Button>
            {locateError && <p id={`locate-error-${p.id}`} role="alert" className="basis-full text-xs text-danger">{t("projects.locateFailed", { name: p.name, error: locateError })}</p>}
          </form>
        )}
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <div><dt className="sr-only">{t("projects.neverOpened")}</dt><dd>{p.lastOpened ? t("projects.openedAgo", { when: f.timeAgo(p.lastOpened) }) : t("projects.neverOpened")}</dd></div>
        {p.counts ? (
          <>
            <div><dt className="sr-only">{tn("projects.openTasks", 2)}</dt><dd>{tn("projects.openTasks", p.counts.open)}</dd></div>
            <div>
              <dt className="sr-only">{tn("projects.needsYou", 2)}</dt>
              <dd className={cn(p.counts.needsYou > 0 && "font-medium text-amber")}>{tn("projects.needsYou", p.counts.needsYou)}</dd>
            </div>
          </>
        ) : (
          <div><dt className="sr-only">{t("projects.countsUnknown")}</dt><dd>{t("projects.countsUnknown")}</dd></div>
        )}
      </dl>

      <div role="group" aria-label={t("projects.actionsFor", { name: p.name })} className="flex items-center gap-1">
        {p.missing ? (
          !locating && <Button size="sm" variant="outline" className="h-8" onClick={() => setLocating(true)}><FolderSearch />{t("projects.locate")}</Button>
        ) : !current && (
          <Button size="sm" variant="outline" className="h-8" onClick={onOpen} aria-label={t("projects.openLabel", { name: p.name })}>{t("projects.open")}</Button>
        )}
        <Button size="icon" variant="ghost" className={iconButton} title={p.pinned ? t("projects.unpin") : t("projects.pin")} aria-label={p.pinned ? t("projects.unpin") : t("projects.pin")} aria-pressed={p.pinned} onClick={() => onPatch({ pinned: !p.pinned })}>
          {p.pinned ? <PinOff /> : <Pin />}
        </Button>
        <Button size="icon" variant="ghost" className={iconButton} title={t("projects.rename")} aria-label={t("projects.rename")} onClick={() => { setDraft(p.name); setEditing(true) }}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" className={iconButton} title={p.archived ? t("projects.unarchive") : t("projects.archive")} aria-label={p.archived ? t("projects.unarchive") : t("projects.archive")} onClick={() => onPatch({ archived: !p.archived })}>
          {p.archived ? <ArchiveRestore /> : <Archive />}
        </Button>
        {/* a disabled button gets no pointer events, so the reason sits on its wrapper */}
        <span title={removeBlocked ?? t("projects.remove")}>
          <Button size="icon" variant="ghost" className={cn(iconButton, "hover:text-danger")} aria-label={t("projects.remove")} aria-description={removeBlocked ?? undefined} disabled={!!removeBlocked} onClick={onRemove}>
            <Trash2 />
          </Button>
        </span>
      </div>
    </li>
  )
}
