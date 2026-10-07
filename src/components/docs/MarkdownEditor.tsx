"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Check, Download, ListTodo, Pencil, Users } from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import type { Extension } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorToolbar } from "./EditorToolbar"
import { tNow, useT } from "@/context/LanguageContext"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { useApp } from "@/context/AppContext"
import { askAgent } from "@/lib/ask-agent"
import type { TextEdit } from "@/lib/diff"
import { docStats } from "@/lib/headings"
import { setDocProperty, stripFrontmatter } from "@/lib/doc-priority"
import { stripMetaBlock } from "@/lib/meta-block"

export type ViewMode = "edit" | "split" | "preview"

type SaveStatus = "saved" | "saving" | "unsaved"

interface Props {
  docPath: string
  initialContent: string
  onSave: (content: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onContentChange?: (content: string) => void
  wordWrap?: boolean
  lineNumbers?: boolean
  /** Left end of the doc bar (back button, path) */
  barStart?: ReactNode
  /** Right end of the doc bar, after the built-in tools (outline, linked docs, ⋯ menu); gets the mode */
  barEnd?: (mode: ViewMode) => ReactNode
  /** Title + meta, set at the top of the reading column */
  titleBlock?: ReactNode
  /** Right column beside the editor/preview area, below the doc bar (linked docs) */
  aside?: ReactNode
  /** Passed to the preview's MarkdownRenderer (T507) */
  headingAction?: { id: string; node: ReactNode }
}

export function MarkdownEditor({ docPath, initialContent, onSave, onDirtyChange, onContentChange, wordWrap = true, lineNumbers = true, barStart, barEnd, titleBlock, aside, headingAction }: Props) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  // state, not editorRef.current.view at render: the toolbar must re-render once the view exists, or its buttons do nothing
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const { rootParam, demo } = useApp()
  const { t } = useT()
  const ytextRef = useRef<import("yjs").Text | null>(null)
  const awarenessRef = useRef<{ getStates: () => Map<number, unknown> } | null>(null)
  const [chosenMode, setViewMode] = useState<ViewMode>(initialContent.trim() ? "preview" : "edit")
  // Read-only demo (R042): preview only, so no editor mounts and nothing autosaves
  const viewMode: ViewMode = demo ? "preview" : chosenMode
  const [previewContent, setPreviewContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [userCount, setUserCount] = useState(1)
  // When the agent last edited this doc: the preview marks the blocks that change right after it
  const [aiEditAt, setAiEditAt] = useState(0)
  const viewModeRef = useRef(viewMode)
  useEffect(() => { viewModeRef.current = viewMode }, [viewMode])
  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])

  // Phase 1: base extensions (no yCollab) — shown immediately
  const [baseExtensions, setBaseExtensions] = useState<Extension[]>([])
  // Phase 2: collab extension added after Yjs sync
  const [collabExtensions, setCollabExtensions] = useState<Extension[]>([])
  const [isSynced, setIsSynced] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contentChangeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previewRef = useRef(initialContent)

  useEffect(() => {
    previewRef.current = previewContent
  }, [previewContent])

  // Reset when doc changes
  useEffect(() => {
    setPreviewContent(initialContent)
    previewRef.current = initialContent
    setSaveStatus("saved")
    setBaseExtensions([])
    setCollabExtensions([])
    setIsSynced(false)
    setUserCount(1)
    clearTimeout(saveTimerRef.current)
    clearTimeout(contentChangeTimerRef.current)
    onDirtyChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPath])

  // Load extensions + set up Yjs (browser only via dynamic imports)
  useEffect(() => {
    let destroyed = false
    let providerRef: { disconnect: () => void } | null = null
    let ydocRef: { destroy: () => void } | null = null

    async function setup() {
      const [
        { Doc, UndoManager },
        { WebsocketProvider },
        { yCollab },
        { markdown },
        { editorTheme },
        { EditorView: CMEditorView, placeholder },
      ] = await Promise.all([
        import("yjs"),
        import("y-websocket"),
        import("y-codemirror.next"),
        import("@codemirror/lang-markdown"),
        import("./editor-theme"),
        import("@codemirror/view"),
      ])

      if (destroyed) return

      // Phase 1: show editor immediately with syntax highlighting — no yCollab yet
      const base: Extension[] = [markdown(), editorTheme, placeholder(tNow("docs.emptyHint"))]
      if (wordWrap) base.push(CMEditorView.lineWrapping)
      setBaseExtensions(base)

      // Set up Yjs in the background
      const ydoc = new Doc()
      const ytext = ydoc.getText("codemirror")
      const undoManager = new UndoManager(ytext)
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234"
      const provider = new WebsocketProvider(wsUrl, docPath, ydoc)
      ydocRef = ydoc
      ytextRef.current = ytext
      awarenessRef.current = provider.awareness
      providerRef = provider

      const hue = (Math.random() * 360) | 0
      const color = `hsl(${hue},70%,50%)`
      provider.awareness.setLocalStateField("user", { color, colorLight: color + "44" })
      provider.awareness.on("change", () => {
        setUserCount(provider.awareness.getStates().size)
      })

      provider.on("sync", (synced: boolean) => {
        if (!synced || destroyed) return
        // Initialize ytext from the file content if room is fresh
        if (ytext.length === 0) ytext.insert(0, initialContent)
        // Preview mode has no editor mounted, so nothing else feeds the preview remote changes (agent edits,
        // other tabs). Split/Edit get them through CodeMirror's onChange, which also tracks dirty state.
        ytext.observe(() => {
          if (viewModeRef.current !== "preview") return
          const text = ytext.toString()
          setPreviewContent(text)
          onContentChangeRef.current?.(text)
        })
        // Phase 2: swap in yCollab extension
        setCollabExtensions([yCollab(ytext, provider.awareness, { undoManager })])
        setIsSynced(true)
      })
    }

    setup().catch(console.error)

    return () => {
      destroyed = true
      ytextRef.current = null
      awarenessRef.current = null
      providerRef?.disconnect()
      ydocRef?.destroy()
    }
  }, [docPath, initialContent])

  // Agent changed this doc (MCP or accepted proposal): apply the change to the shared Yjs room so the
  // editor shows it and auto-save doesn't overwrite it. Only the touched spans change, so the user's
  // unsaved typing elsewhere survives. One tab (lowest Yjs clientID) applies it; others get it via sync.
  useEffect(() => {
    async function onSse(e: Event) {
      const msg = (e as CustomEvent).detail
      // A property change (from you or an agent) rewrites only the frontmatter; apply the same rewrite here
      const properties: Record<string, string | null> | undefined = msg?.payload?.properties
      // `external`: a write from outside this editor that isn't an agent's (R069: merging an epic's spec changes)
      if (msg?.type !== "doc_updated" || (msg.payload?.actor !== "ai" && !msg.payload?.external && !properties)) return
      if (String(msg.payload.path).replace(/^\.\//, "") !== docPath) return
      if (!properties && msg.payload.actor === "ai") setAiEditAt(Date.now())
      const ytext = ytextRef.current
      const awareness = awarenessRef.current
      if (!ytext?.doc || !awareness) return
      if (Math.min(...Array.from(awareness.getStates().keys())) !== ytext.doc.clientID) return

      const edits: TextEdit[] | undefined = Array.isArray(msg.payload.edits) ? msg.payload.edits : undefined
      let target: string | null = null
      if (properties) {
        try {
          target = Object.entries(properties).reduce((c, [k, v]) => setDocProperty(c, k, v), ytext.toString())
        } catch { return } // the buffer turned the key into a list meanwhile; the file already has the change
      } else if (!edits) {
        // Whole-file write (e.g. vibedoc_write_doc from another agent): splice in only the differing middle
        const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(docPath)}`)
        const content = (await res.json())?.content
        if (typeof content !== "string") return
        target = content
      }

      ytext.doc.transact(() => {
        if (edits) {
          for (const { old_string, new_string } of edits) {
            const text = ytext.toString()
            const at = old_string === "" ? (text === "" ? 0 : -1) : text.indexOf(old_string)
            if (at === -1) continue // already applied (synced from another tab) or edited away by the user
            ytext.delete(at, old_string.length)
            ytext.insert(at, new_string)
          }
        } else if (target !== null) {
          const text = ytext.toString()
          let pre = 0
          while (pre < text.length && pre < target.length && text[pre] === target[pre]) pre++
          let suf = 0
          while (suf < text.length - pre && suf < target.length - pre && text[text.length - 1 - suf] === target[target.length - 1 - suf]) suf++
          ytext.delete(pre, text.length - pre - suf)
          ytext.insert(pre, target.slice(pre, target.length - suf))
        }
      })
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [docPath, rootParam])

  // Rebuild base extensions when editor prefs change (without reconnecting Yjs)
  useEffect(() => {
    if (baseExtensions.length === 0) return // not yet loaded
    async function rebuild() {
      const [{ markdown }, { editorTheme }, { EditorView: CMEditorView, lineNumbers: cmLineNumbers, placeholder }] =
        await Promise.all([
          import("@codemirror/lang-markdown"),
          import("./editor-theme"),
          import("@codemirror/view"),
        ])
      const base: Extension[] = [markdown(), editorTheme, placeholder(tNow("docs.emptyHint"))]
      if (wordWrap) base.push(CMEditorView.lineWrapping)
      if (lineNumbers) base.push(cmLineNumbers())
      setBaseExtensions(base)
    }
    rebuild().catch(console.error)
  }, [wordWrap, lineNumbers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: 2s debounce, only when "unsaved"
  useEffect(() => {
    if (saveStatus !== "unsaved") return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      try {
        await onSave(previewRef.current)
        setSaveStatus("saved")
        onDirtyChange?.(false)
      } catch {
        setSaveStatus("unsaved")
      }
    }, 2000)
    return () => clearTimeout(saveTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewContent, saveStatus])

  // Ctrl+S / Cmd+S — immediate save
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        clearTimeout(saveTimerRef.current)
        setSaveStatus("saving")
        onSave(previewRef.current)
          .then(() => { setSaveStatus("saved"); onDirtyChange?.(false) })
          .catch(() => setSaveStatus("unsaved"))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onSave, onDirtyChange])

  const handleChange = useCallback(
    (value: string) => {
      // Skip if content hasn't actually changed (e.g. yCollab initial sync fires onChange
      // with the same content, which would incorrectly mark the doc as dirty)
      if (value === previewRef.current) return
      setPreviewContent(value)
      setSaveStatus("unsaved")
      onDirtyChange?.(true)
      clearTimeout(contentChangeTimerRef.current)
      contentChangeTimerRef.current = setTimeout(() => { onContentChange?.(value) }, 500)
    },
    [onDirtyChange, onContentChange]
  )

  function handleDownload() {
    const blob = new Blob([previewRef.current], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = docPath.split("/").pop() ?? "document.md"
    a.click()
    URL.revokeObjectURL(url)
  }

  const showEditor = viewMode !== "preview"
  const showPreview = viewMode !== "edit"
  const extensions = isSynced ? [...baseExtensions, ...collabExtensions] : baseExtensions
  const statusText = saveStatus === "saving" ? t("docs.saving") : saveStatus === "saved" ? t("docs.saved") : t("docs.unsaved")
  const statusColor = saveStatus === "unsaved" ? "text-amber" : "text-muted"

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col h-full overflow-hidden">
      {/* Doc bar: where the doc lives on the left, the mode and every tool on the right */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1 font-mono text-[11px] text-muted">{barStart}</div>
        {!demo && <>
        <span role="status" className={`mr-2 flex items-center gap-1 whitespace-nowrap text-xs ${statusColor} ${saveStatus === "saved" ? "max-sm:sr-only" : ""}`}>
          {saveStatus === "saved" && <Check className="h-3 w-3 animate-in fade-in zoom-in-50 duration-(--duration-base)" aria-hidden />}{statusText}
        </span>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-7 bg-surface2 p-0.5">
            <TabsTrigger value="preview" className="h-6 px-2.5 text-xs">{t("docs.preview")}</TabsTrigger>
            <TabsTrigger value="split" className="h-6 px-2.5 text-xs max-md:hidden">{t("docs.split")}</TabsTrigger>
            <TabsTrigger value="edit" className="h-6 px-2.5 text-xs">{t("docs.edit")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mx-1.5 h-4 w-px bg-border" aria-hidden />
        </>}
        {userCount > 1 && (
          <Badge variant="secondary" className="h-5 gap-1 text-[10px] px-1.5 max-sm:hidden" title={t("docs.tabsOpen", { n: userCount })}>
            <Users className="h-3 w-3" />{userCount}
          </Badge>
        )}
        {docPath.endsWith(".md") && !demo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted hover:text-txt max-sm:hidden" aria-label={t("docs.breakDownWithAgent")}
                onClick={() => askAgent(`Break down the spec in ${docPath} into tasks.`)}>
                <ListTodo className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("docs.breakDownWithAgent")}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted hover:text-txt max-sm:hidden" onClick={handleDownload} aria-label={t("docs.download")}>
              <Download className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("docs.download")}</TooltipContent>
        </Tooltip>
        {barEnd?.(viewMode)}
      </div>

      {/* Toolbar — hidden in preview mode */}
      {viewMode !== "preview" && (
        <div className={viewMode === "split" ? "max-md:hidden" : undefined}>
          <EditorToolbar editorView={editorView} />
        </div>
      )}

      {/* Editor / Preview area, then the optional right column */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className={`min-w-0 flex-1 overflow-hidden ${
          showEditor && showPreview ? "grid grid-cols-2 divide-x divide-border max-md:grid-cols-1" : "flex"
        }`}
      >
        {showEditor && (
          // the doc's own text (R078: never translated; e2e/i18n.mjs skips [data-user-content]); data-synced = the Yjs room is live
          <div data-user-content data-synced={isSynced || undefined} className={`animate-pane-in flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${showPreview ? "max-md:hidden" : ""}`}>
            {baseExtensions.length === 0 ? (
              // Modules not yet loaded — show a plain fallback
              <div className="flex-1 overflow-auto whitespace-pre-wrap bg-bg px-4 py-3 font-mono text-sm text-txt">
                {previewContent}
              </div>
            ) : (
              <CodeMirror
                ref={editorRef}
                onCreateEditor={setEditorView}
                key={docPath}
                // Phase 1: value prop drives content. Phase 2: yCollab drives content.
                value={previewContent}
                theme="none"
                onChange={handleChange}
                extensions={extensions}
                style={{ height: "100%", overflow: "auto" }}
                className="h-full text-sm"
              />
            )}
          </div>
        )}

        {showPreview && (
          // keyed by doc: opening another doc starts at its top and settles in, instead of keeping the old scroll
          <div key={docPath} className="flex-1 overflow-y-auto min-w-0 px-5 pt-10 pb-24 sm:px-10 sm:pt-14">
            <div className="animate-doc-in">
            {titleBlock && <div className="mx-auto w-full max-w-[72ch]">{titleBlock}</div>}
            {!previewContent.trim() && (
              <div className="mx-auto flex w-full max-w-[72ch] items-center gap-3 text-sm text-muted">
                {t("docs.docEmpty")}
                {!demo && <Button size="sm" variant="outline" onClick={() => setViewMode("edit")}>
                  <Pencil className="size-3.5" aria-hidden /> {t("docs.startWriting")}
                </Button>}
              </div>
            )}
            {/* a task / epic file's `**Key:** Value` block shows as property rows in the title block (T505) */}
            <MarkdownRenderer
              content={stripMetaBlock(previewContent)}
              className={docStats(stripFrontmatter(previewContent)).title ? "doc-preview doc-preview-titled" : "doc-preview"}
              highlightSince={aiEditAt}
              docPath={docPath}
              headingAction={headingAction}
            />
            </div>
          </div>
        )}
      </div>
      {aside}
      </div>
    </div>
    </TooltipProvider>
  )
}
