"use client"

import { useApp } from "@/context/AppContext"
import type { SelectedDoc } from "@/types"
import { MarkdownEditor } from "./MarkdownEditor"
import { BacklinksPanel } from "./BacklinksPanel"
import { DocActionsMenu, type DocActions } from "./DocActionsMenu"
import { useItemCommands } from "@/components/shared/item-commands"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import { DocOutline } from "./DocOutline"
import { docStats, extractHeadings } from "@/lib/headings"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bot, PanelLeftClose, PanelLeftOpen, Plus, User } from "lucide-react"
import { DOCS_LIST_KEY } from "@/lib/shortcuts"

const kbdClass = "rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] leading-4 text-txt"

interface DocViewerProps {
  doc: SelectedDoc | null
  onDirtyChange?: (dirty: boolean) => void
  onContentChange?: (content: string) => void
  docActions?: DocActions
  /** Live editor content (debounced) so the title and stats follow typing */
  content?: string
  /** Docs in the project; undefined while searching */
  docCount?: number
  onNewDocClick?: () => void
  listCollapsed?: boolean
  onToggleList?: () => void
}

export function DocViewer({ doc, onDirtyChange, onContentChange, docActions, content, docCount, onNewDocClick, listCollapsed = false, onToggleList }: DocViewerProps) {
  const { rootParam, setSelectedDoc, openDoc, editorSettings } = useApp()
  const path = doc?.path ?? ""
  useItemCommands(doc && docActions ? path : null, docActions ? [
    { action: "edit", label: "Rename", run: () => docActions.rename(path) },
    { action: "duplicate", label: "Duplicate", run: () => docActions.duplicate(path) },
    { action: "chat", label: "Chat about this doc", run: () => docActions.chat(path) },
    { action: "remove", label: "Delete", run: () => docActions.remove(path) },
  ] : [])

  if (!doc) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 pt-[18vh] pb-12">
        <h2 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-balance text-txt">
          {docCount === undefined ? "Pick a doc to read" : docCount === 0 ? "No docs yet" : (
            <><span className="font-mono">{docCount}</span> docs in this project</>
          )}
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {docCount === 0
            ? "Docs are plain markdown files in your repo. Your agent reads and edits the same files."
            : "Choose one from the list. Your agent reads and edits the same files, and its changes show up here live."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          {onNewDocClick && (
            <Button size="sm" onClick={onNewDocClick}>
              <Plus className="size-4" aria-hidden /> New doc
            </Button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <kbd className={kbdClass}>⌘P</kbd> jump to a doc
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <kbd className={kbdClass}>⌘K</kbd> search content
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
      throw new Error(data.error ?? "Save failed")
    }
    setSelectedDoc({ ...doc!, content, lastEdit: { actor: "human", at: new Date().toISOString() } })
  }

  const slash = doc.path.lastIndexOf("/")
  const fileName = doc.path.slice(slash + 1)
  const stats = docStats(content ?? doc.content)
  const title = stats.title ?? fileName.replace(/\.md$/, "")
  const lastEdit = doc.lastEdit
  const headings = extractHeadings(content ?? doc.content)
  return (
    <div className="flex h-full flex-col">
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
              aria-label="Back to docs"
              className="-ml-1.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface2 hover:text-txt md:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
            {onToggleList && (
              <button
                type="button"
                onClick={onToggleList}
                aria-label={listCollapsed ? "Show docs list" : "Hide docs list"}
                aria-keyshortcuts="Meta+Backslash"
                title={`${listCollapsed ? "Show" : "Hide"} docs list (${DOCS_LIST_KEY.label})`}
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
            <BacklinksPanel key={doc.path} docPath={doc.path} rootParam={rootParam} onOpenDoc={openDoc} />
            {docActions && <DocActionsMenu path={doc.path} actions={docActions} />}
          </>
        )}
        titleBlock={
          <header className="mb-8">
            <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-balance text-txt">{title}</h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
              {lastEdit && (
                <>
                  <span className="inline-flex items-center gap-1" title={`Last edited ${new Date(lastEdit.at).toLocaleString()}`}>
                    {lastEdit.actor === "ai" ? <Bot className="size-3.5 text-accent" aria-hidden /> : <User className="size-3.5" aria-hidden />}
                    Edited by {lastEdit.actor === "ai" ? "AI" : "you"} · {timeAgo(lastEdit.at)}
                  </span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{stats.words.toLocaleString()} words</span>
              <span aria-hidden>·</span>
              <span>{stats.minutes} min read</span>
            </p>
          </header>
        }
      />
    </div>
  )
}
