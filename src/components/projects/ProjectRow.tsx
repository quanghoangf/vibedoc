"use client"

import { useState } from "react"
import { Archive, ArchiveRestore, ArrowRight, FolderSearch, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

/**
 * One grid for the header and every row, so the numbers line up in columns. Below `md` a row stacks: identity,
 * then the numbers on one line, with the actions beside the name.
 */
export const PROJECT_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_5.5rem_6rem_8.5rem_7.5rem] md:items-center md:gap-x-4"

/** Two letters for the project tile: "payments-api" → "PA", "vibedoc" → "VI". */
export function initials(name: string): string {
  const words = name.split(/[\s\-_./]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)
  return letters.toUpperCase()
}

export function ProjectTile({ name, current, className }: { name: string; current?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-medium",
        current ? "border-accent/40 bg-accent/12 text-accent" : "border-border2 bg-surface2 text-muted",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/** A long absolute path keeps its tail ("…/work/payments-api"): the end names the project, the start is noise. */
export function TailPath({ path, className }: { path: string; className?: string }) {
  return (
    <span
      title={path}
      // rtl clips from the start; the LRM keeps "/" and punctuation in path order
      className={cn("block truncate font-mono text-[11px] text-muted [direction:rtl] text-left", className)}
      data-user-content
    >
      {"‎" + path}
    </span>
  )
}

/** One project on All projects (T531): who it is, what is open, what needs you, when it was opened, its actions. */
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
  const openable = !current && !p.missing
  const needs = p.counts?.needsYou ?? 0

  return (
    <li
      data-project-row={p.id}
      className={cn(
        "group/row relative flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors duration-150 hover:bg-surface2/50",
        PROJECT_GRID,
        current && "bg-accent/[0.04]",
      )}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <ProjectTile name={p.name} current={current} className={cn(p.missing && "opacity-50")} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(p.name) } }}
                aria-label={t("projects.renameLabel", { name: p.name })}
                className="h-8 w-full max-w-64 min-w-0 rounded-md border border-border bg-bg px-2 text-sm text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-user-content
              />
              <Button type="submit" size="sm" variant="secondary" className="h-8">{t("projects.save")}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setDraft(p.name) }}>{t("projects.cancel")}</Button>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              {openable ? (
                // The name opens the project; the stretched hit area covers the row, the actions sit above it
                <button
                  type="button"
                  onClick={onOpen}
                  className="min-w-0 truncate rounded-sm text-left text-sm font-medium text-txt outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent"
                  data-user-content
                >
                  {p.name}
                </button>
              ) : (
                <span className={cn("min-w-0 truncate text-sm font-medium", p.missing ? "text-muted" : "text-txt")} data-user-content>{p.name}</span>
              )}
              {p.pinned && <Pin aria-label={t("projects.pinned")} className="size-3 shrink-0 text-muted" />}
              {current && <span className="shrink-0 rounded-sm bg-accent/15 px-1.5 py-px text-[11px] font-medium text-accent">{t("projects.current")}</span>}
              {p.missing && <span data-missing className="shrink-0 rounded-sm bg-danger/15 px-1.5 py-px text-[11px] font-medium text-danger">{t("projects.missing")}</span>}
            </div>
          )}
          <TailPath path={p.root} className={cn("mt-0.5", p.missing && "line-through")} />
          {p.missing && !locating && <p className="mt-1 text-xs text-muted">{t("projects.missingHint")}</p>}
          {locating && (
            <form className="relative z-10 mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); locate() }}>
              <input
                autoFocus
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setLocating(false); setLocateError(null) } }}
                placeholder={t("projects.locatePlaceholder")}
                aria-label={t("projects.locateLabel", { name: p.name })}
                aria-invalid={!!locateError || undefined}
                aria-describedby={locateError ? `locate-error-${p.id}` : undefined}
                className="h-8 min-w-0 flex-1 basis-60 rounded-md border border-border bg-bg px-2 font-mono text-xs text-txt outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button type="submit" size="sm" variant="secondary" className="h-8" disabled={!where.trim()}>{t("projects.locate")}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setLocating(false); setLocateError(null) }}>{t("projects.cancel")}</Button>
              {locateError && <p id={`locate-error-${p.id}`} role="alert" className="basis-full text-xs text-danger">{t("projects.locateFailed", { name: p.name, error: locateError })}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Numbers: their own line below md, three columns from md */}
      <dl className="order-last flex basis-full flex-wrap gap-x-4 gap-y-1 pl-11 text-xs text-muted md:order-none md:contents md:pl-0">
        {p.counts ? (
          <>
            <div className="md:text-right">
              <dt className="sr-only">{tn("projects.openTasks", 2)}</dt>
              <dd className="tabular-nums"><span className="text-txt md:text-sm">{p.counts.open}</span><span className="md:sr-only"> {t("projects.colOpen").toLowerCase()}</span></dd>
            </div>
            <div className="md:text-right">
              <dt className="sr-only">{tn("projects.needsYou", 2)}</dt>
              <dd>
                {needs > 0 ? (
                  <span className="inline-flex items-center rounded-sm bg-amber/15 px-1.5 py-px font-medium tabular-nums text-amber"><span className="md:hidden">{tn("projects.needsYou", needs)}</span><span className="hidden md:inline"><span aria-hidden>{needs}</span><span className="sr-only">{tn("projects.needsYou", needs)}</span></span></span>
                ) : (
                  <span className="tabular-nums"><span aria-hidden className="hidden md:inline">—</span><span className="md:sr-only">{tn("projects.needsYou", 0)}</span></span>
                )}
              </dd>
            </div>
          </>
        ) : (
          <div className="md:col-span-2 md:text-right"><dt className="sr-only">{t("projects.countsUnknown")}</dt><dd>{t("projects.countsUnknown")}</dd></div>
        )}
        <div className="md:text-right">
          <dt className="sr-only">{t("projects.colOpened")}</dt>
          <dd>{p.lastOpened ? t("projects.openedAgo", { when: f.timeAgo(p.lastOpened) }) : t("projects.neverOpened")}</dd>
        </div>
      </dl>

      <div role="group" aria-label={t("projects.actionsFor", { name: p.name })} className="relative z-10 flex items-center justify-end gap-1">
        {p.missing ? (
          !locating && <Button size="sm" variant="outline" className="h-8" onClick={() => setLocating(true)}><FolderSearch />{t("projects.locate")}</Button>
        ) : openable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-muted group-hover/row:text-txt"
            onClick={onOpen}
            aria-label={t("projects.openLabel", { name: p.name })}
          >
            {t("projects.open")}<ArrowRight className="transition-transform duration-150 group-hover/row:translate-x-0.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8 text-muted hover:text-txt" aria-label={t("projects.moreFor", { name: p.name })} title={t("projects.more")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onPatch({ pinned: !p.pinned })}>
              {p.pinned ? <PinOff /> : <Pin />}{p.pinned ? t("projects.unpin") : t("projects.pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setDraft(p.name); setEditing(true) }}>
              <Pencil />{t("projects.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPatch({ archived: !p.archived })}>
              {p.archived ? <ArchiveRestore /> : <Archive />}{p.archived ? t("projects.unarchive") : t("projects.archive")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!!removeBlocked}
              onSelect={onRemove}
              title={removeBlocked ?? undefined}
              className="text-danger focus:text-danger"
            >
              <Trash2 />
              <span className="flex flex-col">
                {t("projects.remove")}
                {removeBlocked && <span className="text-[11px] text-muted">{removeBlocked}</span>}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
