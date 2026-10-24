"use client"

import { useState, useEffect, useRef } from "react"
import type { DocFile, SelectedDoc } from "@/types"
import type { LazyFolder } from "@/lib/doc-scope"
import { DocList } from "./DocList"
import { DocViewer } from "./DocViewer"
import type { DocActions } from "./DocActionsMenu"
import { cn } from "@/lib/utils"
import { DOCS_LIST_KEY, TOGGLE_DOCS_LIST_EVENT } from "@/lib/shortcuts"
import { docNode } from "@/lib/doc-links"
import { API_LIST, ApiReference, ApiReferenceRow, type ApiSpecList } from "./ApiReference"
import { ArrowLeft } from "lucide-react"
import { useT } from "@/context/LanguageContext"

// ponytail: module-level like DocList's width — survives page navigation, resets on reload (no localStorage)
let lastListCollapsed = false

interface DocsTabProps {
  docs: DocFile[]
  selectedDoc: SelectedDoc | null
  docSearch: string
  onSearchChange: (value: string) => void
  onDocSelect: (path: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onNewDocClick?: () => void
  onDocDeleted?: (path: string) => void
  onDocRenamed?: (oldPath: string, newPath: string) => void
  rootParam?: string
  docActions?: DocActions
  /** R094: the project's OpenAPI spec (null until loaded) and the open `?api=` view */
  apiSpec?: ApiSpecList | null
  apiOpen?: string | null
  onApiOpen?: (key: string | null) => void
  /** Folders outside docs/, plans/ and memory/ not opened yet, and how to open one */
  lazyFolders?: LazyFolder[]
  onOpenFolder?: (name: string) => Promise<void>
  /** Doc names that look like a search that found nothing */
  searchSuggestions?: string[]
}

export function DocsTab({ docs, selectedDoc, docSearch, onSearchChange, onDocSelect, onDirtyChange, onNewDocClick, onDocDeleted, onDocRenamed, rootParam, docActions, apiSpec, apiOpen, onApiOpen, lazyFolders = [], onOpenFolder, searchSuggestions }: DocsTabProps) {
  const { t } = useT()
  const [liveContent, setLiveContent] = useState(selectedDoc?.content ?? "")
  useEffect(() => { setLiveContent(selectedDoc?.content ?? "") }, [selectedDoc?.path])
  const [listCollapsed, setListCollapsed] = useState(lastListCollapsed)
  // Split hides the list (the editor and the preview need the width); leaving Split brings back what was there.
  // Showing the list by hand while in Split overrides it until the next time Split is entered.
  const [splitHidesList, setSplitHidesList] = useState(false)
  const splitHidesRef = useRef(false)
  const onSplitChange = (split: boolean) => { splitHidesRef.current = split; setSplitHidesList(split) }

  useEffect(() => {
    const toggle = () => {
      if (splitHidesRef.current) {
        splitHidesRef.current = false
        setSplitHidesList(false)
        lastListCollapsed = false
        setListCollapsed(false)
        return
      }
      lastListCollapsed = !lastListCollapsed
      setListCollapsed(lastListCollapsed)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === DOCS_LIST_KEY.key) { e.preventDefault(); toggle() }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(TOGGLE_DOCS_LIST_EVENT, toggle)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(TOGGLE_DOCS_LIST_EVENT, toggle) }
  }, [])
  const showApi = !!apiOpen && !!apiSpec?.path
  // `?api=` in a project with no spec: say so (a note with a way back), never the landing as if nothing was asked
  const apiMissing = !!apiOpen && !!apiSpec && !apiSpec.path && !selectedDoc
  // With no doc open the list is the page, so it never hides
  const hideList = (listCollapsed || (splitHidesList && !!selectedDoc && !showApi)) && (!!selectedDoc || showApi)
  // An empty project: on phones the viewer's empty state (what fills Docs, New doc) is the page, not an empty list
  const noDocs = !selectedDoc && !showApi && !apiSpec?.path && docs.length === 0 && lazyFolders.length === 0 && !docSearch.trim()

  return (
    // A fixed height (the header is 3rem), so the list and the doc each scroll in their own pane, never the page
    <div className="relative flex h-[calc(100svh-3rem)] min-h-0 overflow-hidden">
      <DocList
        top={apiSpec?.path && onApiOpen ? <ApiReferenceRow count={apiSpec.endpoints?.length ?? 0} active={showApi} onClick={() => onApiOpen(API_LIST)} /> : null}
        className={selectedDoc || showApi || apiMissing || noDocs ? "max-md:hidden" : undefined}
        collapsed={hideList}
        docs={docs}
        selectedDocPath={selectedDoc?.path}
        searchValue={docSearch}
        onSearchChange={onSearchChange}
        onDocClick={onDocSelect}
        onNewDocClick={onNewDocClick}
        rootParam={rootParam}
        docActions={docActions}
        lazyFolders={lazyFolders}
        onOpenFolder={onOpenFolder}
        suggestions={searchSuggestions}
      />
      <div className={cn("flex-1 min-w-0 overflow-y-auto", !selectedDoc && !showApi && !apiMissing && !noDocs && "max-md:hidden")}>
        {showApi && apiSpec && apiOpen && onApiOpen ? (
          <ApiReference spec={apiSpec} open={apiOpen} onOpen={onApiOpen} rootParam={rootParam ?? "?"} />
        ) : apiMissing ? (
          <div data-api-missing className="mx-auto flex max-w-xl flex-col gap-3 px-6 pt-[18vh] pb-12">
            <h2 className="text-lg font-semibold text-txt">{t("docs.apiNoSpec")}</h2>
            {/* a spec that was found but refused (Swagger 2, bad YAML) says why */}
            <p className="text-sm leading-relaxed text-muted">{apiSpec?.error ?? t("docs.apiNoSpecHint")}</p>
            <button type="button" onClick={() => onApiOpen?.(null)} className="inline-flex w-fit items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent/60 outline-hidden rounded-sm">
              <ArrowLeft className="size-3.5" aria-hidden /> {t("docs.backToDocs")}
            </button>
          </div>
        ) : (
        <DocViewer
          doc={selectedDoc}
          onDirtyChange={onDirtyChange}
          onContentChange={setLiveContent}
          docActions={docActions}
          content={liveContent}
          docCount={docSearch.trim() ? undefined : { files: docs.length, docs: docs.filter((d) => docNode(d.path, "").kind === "doc").length }}
          onNewDocClick={onNewDocClick}
          listCollapsed={hideList}
          onToggleList={() => window.dispatchEvent(new Event(TOGGLE_DOCS_LIST_EVENT))}
          onDocClick={onDocSelect}
          onSplitChange={onSplitChange}
        />
        )}
      </div>
    </div>
  )
}
