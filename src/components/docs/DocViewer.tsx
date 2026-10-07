"use client"

import { useState } from "react"
import Link from "next/link"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"
import type { SelectedDoc } from "@/types"
import { MarkdownEditor } from "./MarkdownEditor"
import { LinkedDocs } from "./LinkedDocs"
import { useDocLinks } from "./useDocLinks"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DocActionsMenu, type DocActions } from "./DocActionsMenu"
import { useItemCommands } from "@/components/shared/item-commands"
import { DocOutline } from "./DocOutline"
import { docStats, extractHeadings } from "@/lib/headings"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bot, Link2, PanelLeftClose, PanelLeftOpen, Plus, Unlink, User, Waypoints } from "lucide-react"
import { DOCS_LIST_KEY } from "@/lib/shortcuts"
import { stripFrontmatter } from "@/lib/doc-priority"
import { DocProperties } from "./DocProperties"
import { graphHref } from "@/lib/doc-links"
import { useT } from "@/context/LanguageContext"

const kbdClass = "rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] leading-4 text-txt"

interface DocViewerProps {
  doc: SelectedDoc | null
  onDirtyChange?: (dirty: boolean) => void
  onContentChange?: (content: string) => void
  docActions?: DocActions
  /** Live editor content (debounced) so the title and stats follow typing */
  content?: string
  /** Markdown files in the project and how many are docs (not tasks, epics, entries or ADRs; as /graph counts them); undefined while searching */
  docCount?: { files: number; docs: number }
  onNewDocClick?: () => void
  listCollapsed?: boolean
  onToggleList?: () => void
}

export function DocViewer({ doc, onDirtyChange, onContentChange, docActions, content, docCount, onNewDocClick, listCollapsed = false, onToggleList }: DocViewerProps) {
  const { rootParam, setSelectedDoc, editorSettings } = useApp()
  const path = doc?.path ?? ""
  const links = useDocLinks(doc?.path)
  // ≥xl: the linked docs column beside the preview (toggled here); below xl: the same lists in a sheet
  const [linksColumn, setLinksColumn] = useState(true)
  const [linksSheet, setLinksSheet] = useState(false)
  const { t, tn } = useT()
  useItemCommands(doc && docActions ? path : null, docActions ? [
    { action: "edit", label: t("docs.rename"), run: () => docActions.rename(path) },
    { action: "duplicate", label: t("docs.duplicate"), run: () => docActions.duplicate(path) },
    { action: "chat", label: t("docs.chatAboutDoc"), run: () => docActions.chat(path) },
    { action: "remove", label: t("board.delete"), run: () => docActions.remove(path) },
  ] : [])

  if (!doc) {
    return (
      // an empty project's page is a teaching empty state (R083): what fills it, and New doc as its one action
      <div data-empty-state={docCount?.files === 0 ? "" : undefined} className="mx-auto flex max-w-xl flex-col gap-4 px-6 pt-[18vh] pb-12">
        <h2 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-balance text-txt">
          {docCount === undefined ? t("docs.pickDoc") : docCount.files === 0 ? t("docs.noDocs") : docCount.files === docCount.docs
            ? tn("docs.docsInProject", docCount.files)
            : t("docs.filesAndDocs", { files: docCount.files, docs: docCount.docs })}
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {docCount?.files === 0 ? t("docs.noDocsHint") : t("docs.pickDocHint")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          {onNewDocClick && (
            <span data-empty-action={docCount?.files === 0 ? "" : undefined}>
              <Button size="sm" onClick={onNewDocClick}>
                <Plus className="size-4" aria-hidden /> {t("docs.newDoc")}
              </Button>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <kbd className={kbdClass}>⌘P</kbd> {t("docs.jumpToDoc")}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <kbd className={kbdClass}>⌘K</kbd> {t("docs.searchContent")}
          </span>
        </div>
      </div>
    )
  }

  async function handleSave(content: string) {
    const res = await fetch(`/api/docs${rootParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: doc!.path, content }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? t("docs.saveFailed"))
    }
    setSelectedDoc({ ...doc!, content, lastEdit: { actor: "human", at: new Date().toISOString() } })
  }

  const slash = doc.path.lastIndexOf("/")
  const fileName = doc.path.slice(slash + 1)
  const raw = content ?? doc.content
  const body = stripFrontmatter(raw)
  const stats = docStats(body)
  const title = stats.title ?? fileName.replace(/\.md$/, "")
  const lastEdit = doc.lastEdit
  const headings = extractHeadings(body)
  // unique files either way (a file both linked to and from counts once); broken links count apart
  const linkCount = links ? new Set([...links.out, ...links.in].map((l) => l.path)).size : null
  const brokenCount = links?.broken.length ?? 0
  const linksButton = (onClick: () => void, className: string, pressed?: boolean) => (
    <Button variant="ghost" size="sm" onClick={onClick} aria-pressed={pressed}
      aria-label={[linkCount !== null ? t("docs.linkedDocsCount", { n: linkCount }) : t("docs.linkedDocs"), brokenCount ? t("docs.brokenSuffix", { n: brokenCount }) : ""].filter(Boolean).join(", ")} title={t("docs.linkedDocs")}
      className={`h-7 gap-1 px-1.5 text-muted hover:text-txt ${pressed ? "bg-surface2 text-txt" : ""} ${className}`}>
      <Link2 className="h-3.5 w-3.5" aria-hidden />
      {linkCount !== null && <span className="font-mono text-[11px]">{linkCount}</span>}
      {/* muted like /graph's "N broken": a count to look at, not an error (Highlighter Rule) */}
      {brokenCount > 0 && <span className="ml-0.5 inline-flex items-center gap-0.5 font-mono text-[11px]"><Unlink className="size-3" aria-hidden />{brokenCount}</span>}
    </Button>
  )
  return (
    <div className="flex h-full flex-col">
      <Sheet open={linksSheet} onOpenChange={setLinksSheet}>
        <SheetContent side="right" aria-describedby={undefined} className="flex w-80 flex-col gap-4 overflow-y-auto border-border bg-surface p-5 text-txt sm:max-w-80">
          <SheetTitle className="text-sm font-semibold text-txt">{t("docs.linkedDocs")}</SheetTitle>
          <LinkedDocs links={links} path={doc.path} onNavigate={() => setLinksSheet(false)} />
        </SheetContent>
      </Sheet>
      <MarkdownEditor
        docPath={doc.path}
        initialContent={doc.content}
        onSave={handleSave}
        onDirtyChange={onDirtyChange}
        onContentChange={onContentChange}
        wordWrap={editorSettings.wordWrap}
        lineNumbers={editorSettings.lineNumbers}
        barStart={
          <>
            <button
              type="button"
              onClick={() => setSelectedDoc(null)}
              aria-label={t("docs.backToDocs")}
              className="-ml-1.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface2 hover:text-txt md:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
            {onToggleList && (
              <button
                type="button"
                onClick={onToggleList}
                aria-label={listCollapsed ? t("docs.showList") : t("docs.hideList")}
                aria-keyshortcuts="Meta+Backslash"
                title={t(listCollapsed ? "docs.showListKey" : "docs.hideListKey", { key: DOCS_LIST_KEY.label })}
                className="-ml-1.5 mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface2 hover:text-txt max-md:hidden"
              >
                {listCollapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
              </button>
            )}
            <span className="flex min-w-0" title={doc.path}>
              {/* the folder gives way first; the file name truncates only once the folder is gone */}
              {slash > 0 && <span className="min-w-0 truncate max-sm:hidden">{doc.path.slice(0, slash + 1)}</span>}
              <span className="max-w-full shrink-0 truncate text-txt">{fileName}</span>
            </span>
          </>
        }
        barEnd={(mode) => (
          <>
            {/* Headings only exist to scroll to where the doc is rendered */}
            {mode !== "edit" && <div className="max-lg:hidden"><DocOutline headings={headings} /></div>}
            <Button variant="ghost" size="sm" asChild className="h-7 px-1.5 text-muted hover:text-txt">
              <Link href={graphHref(doc.path)} aria-label={t("docs.showInGraph")} title={t("docs.showInGraph")}>
                <Waypoints className="size-3.5" aria-hidden />
              </Link>
            </Button>
            {linksButton(() => setLinksSheet(true), "xl:hidden")}
            {linksButton(() => setLinksColumn((v) => !v), "max-xl:hidden", linksColumn)}
            {docActions && <DocActionsMenu path={doc.path} actions={docActions} />}
          </>
        )}
        aside={
          // the column opens and closes (0 ↔ 18rem) so the prose reflow reads as one movement
          <div
            inert={!linksColumn}
            className={cn(
              "grid shrink-0 grid-rows-[minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-(--duration-base) ease-out-soft max-xl:hidden",
              linksColumn ? "grid-cols-[18rem]" : "grid-cols-[0rem]",
            )}
          >
            <aside aria-label={t("docs.linkedDocs")} className="min-h-0 w-72 overflow-y-auto border-l border-border px-4 py-6">
              <LinkedDocs links={links} path={doc.path} />
            </aside>
          </div>
        }
        titleBlock={
          <header className="mb-8 border-b border-border pb-4">
            <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-balance text-txt">{title}</h1>
            <div className="mt-5">
              <DocProperties path={doc.path} content={raw} lastEdit={lastEdit} words={stats.words} minutes={stats.minutes} />
            </div>
          </header>
        }
      />
    </div>
  )
}
