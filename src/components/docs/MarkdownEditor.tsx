"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Download, Users } from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import type { Extension } from "@codemirror/state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorToolbar } from "./EditorToolbar"
import { MarkdownRenderer } from "./MarkdownRenderer"

type ViewMode = "edit" | "split" | "preview"
type SaveStatus = "saved" | "saving" | "unsaved"

interface Props {
  docPath: string
  initialContent: string
  onSave: (content: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onContentChange?: (content: string) => void
  wordWrap?: boolean
  lineNumbers?: boolean
}

export function MarkdownEditor({ docPath, initialContent, onSave, onDirtyChange, onContentChange, wordWrap = true, lineNumbers = true }: Props) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("split")
  const [previewContent, setPreviewContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [userCount, setUserCount] = useState(1)

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
        { oneDark },
        { EditorView: CMEditorView },
      ] = await Promise.all([
        import("yjs"),
        import("y-websocket"),
        import("y-codemirror.next"),
        import("@codemirror/lang-markdown"),
        import("@codemirror/theme-one-dark"),
        import("@codemirror/view"),
      ])

      if (destroyed) return

      // Phase 1: show editor immediately with syntax highlighting — no yCollab yet
      const base: Extension[] = [markdown(), oneDark]
      if (wordWrap) base.push(CMEditorView.lineWrapping)
      setBaseExtensions(base)

      // Set up Yjs in the background
      const ydoc = new Doc()
      const ytext = ydoc.getText("codemirror")
      const undoManager = new UndoManager(ytext)
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234"
      const provider = new WebsocketProvider(wsUrl, docPath, ydoc)
      ydocRef = ydoc
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
        // Phase 2: swap in yCollab extension
        setCollabExtensions([yCollab(ytext, provider.awareness, { undoManager })])
        setIsSynced(true)
      })
    }

    setup().catch(console.error)

    return () => {
      destroyed = true
      providerRef?.disconnect()
      ydocRef?.destroy()
    }
  }, [docPath, initialContent])

  // Rebuild base extensions when editor prefs change (without reconnecting Yjs)
  useEffect(() => {
    if (baseExtensions.length === 0) return // not yet loaded
    async function rebuild() {
      const [{ markdown }, { oneDark }, { EditorView: CMEditorView }, { lineNumbers: cmLineNumbers }] =
        await Promise.all([
          import("@codemirror/lang-markdown"),
          import("@codemirror/theme-one-dark"),
          import("@codemirror/view"),
          import("@codemirror/view"),
        ])
      const base: Extension[] = [markdown(), oneDark]
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

  const editorView = editorRef.current?.view ?? null
  const showEditor = viewMode !== "preview"
  const showPreview = viewMode !== "edit"
  const extensions = isSynced ? [...baseExtensions, ...collabExtensions] : baseExtensions
  const statusText = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Unsaved"
  const statusColor =
    saveStatus === "saving"
      ? "text-muted"
      : saveStatus === "saved"
      ? "text-teal-400"
      : "text-yellow-400"

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col h-full overflow-hidden">
      {/* Single header row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-mono text-muted flex-1 truncate min-w-0">{docPath}</span>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-7 bg-surface2 p-0.5">
            <TabsTrigger value="edit" className="h-6 px-2.5 text-xs">Edit</TabsTrigger>
            <TabsTrigger value="split" className="h-6 px-2.5 text-xs">Split</TabsTrigger>
            <TabsTrigger value="preview" className="h-6 px-2.5 text-xs">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
        {userCount > 1 && (
          <Badge variant="secondary" className="h-5 gap-1 text-[10px] px-1.5">
            <Users className="h-3 w-3" />{userCount}
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download .md</TooltipContent>
        </Tooltip>
        <span className={`text-xs flex items-center gap-1 ${statusColor}`}>
          {saveStatus === "saved" && <Check className="h-3 w-3" />}{statusText}
        </span>
      </div>

      {/* Toolbar — hidden in preview mode */}
      {viewMode !== "preview" && <EditorToolbar editorView={editorView} />}

      {/* Editor / Preview area */}
      <div
        className={`flex-1 overflow-hidden ${
          showEditor && showPreview ? "grid grid-cols-2 divide-x divide-border" : "flex"
        }`}
      >
        {showEditor && (
          <div className="flex flex-col overflow-hidden min-h-0">
            {baseExtensions.length === 0 ? (
              // Modules not yet loaded — show a plain fallback
              <div className="flex-1 p-4 font-mono text-sm text-txt bg-[#282c34] overflow-auto whitespace-pre-wrap">
                {previewContent}
              </div>
            ) : (
              <CodeMirror
                ref={editorRef}
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
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            <MarkdownRenderer content={previewContent} />
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}
