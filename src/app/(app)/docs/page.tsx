"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/context/AppContext"
import { DocsTab } from "@/components/docs/DocsTab"
import { NewDocModal } from "@/components/docs/NewDocModal"
import { DocPathDialog, type DocActions } from "@/components/docs/DocActionsMenu"
import { askAgent } from "@/lib/ask-agent"
import { toast, undoToast } from "@/components/ui/toast"
import type { DocFile } from "@/types"
import type { ApiSpecList } from "@/components/docs/ApiReference"
import { tNow, useT } from "@/context/LanguageContext"

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) return null
    return (await res.json().catch(() => null))?.error ?? tNow("board.requestFailed", { status: res.status })
  } catch {
    return tNow("roadmap.couldNotReach")
  }
}

export default function DocsPage() {
  const { selectedDoc, setSelectedDoc, rootParam, activeProject, demo } = useApp()
  const { t } = useT()
  const [docs, setDocs] = useState<DocFile[]>([])
  const [docSearch, setDocSearch] = useState("")
  const [newDocOpen, setNewDocOpen] = useState(false)
  const isDirtyRef = useRef(false)
  const [pathDialog, setPathDialog] = useState<{ mode: "rename" | "move"; path: string } | null>(null)

  const fetchDocs = useCallback(() => {
    if (!activeProject) return
    fetch(`/api/docs${rootParam}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [activeProject, rootParam])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // R094: the project's OpenAPI spec → "API reference" row; `?api=` (list or "GET /path") is restored on arrival
  const [apiSpec, setApiSpec] = useState<ApiSpecList | null>(null)
  const [apiOpen, setApiOpen] = useState<string | null>(null)
  useEffect(() => {
    if (!activeProject) return
    let live = true
    fetch(`/api/openapi${rootParam}`)
      .then((r) => r.json())
      .then((d: ApiSpecList) => {
        if (!live) return
        setApiSpec(d)
        if (d.path) setApiOpen((cur) => cur ?? new URLSearchParams(window.location.search).get("api"))
      })
      .catch(() => {})
    return () => { live = false }
  }, [activeProject, rootParam])

  const openApi = useCallback((key: string | null) => {
    setApiOpen(key)
    const u = new URL(window.location.href)
    if (key) {
      u.searchParams.set("api", key)
      u.searchParams.delete("doc")
      setSelectedDoc(null)
    } else u.searchParams.delete("api")
    window.history.replaceState(window.history.state, "", u)
  }, [setSelectedDoc])

  // Priorities live in each doc's frontmatter, so any edit (picker, agent, typing) can change the list's badges
  const searchingRef = useRef(false)
  useEffect(() => { searchingRef.current = docSearch.trim() !== "" }, [docSearch])
  useEffect(() => {
    function onSse(e: Event) {
      if ((e as CustomEvent).detail?.type === "doc_updated" && !searchingRef.current) fetchDocs()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [fetchDocs])

  const searchDocsFn = useCallback(async (q: string) => {
    if (!q.trim()) {
      fetchDocs()
      return
    }
    const res = await fetch(`/api/docs${rootParam}&q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setDocs(
      data.results?.map((r: { file: string }) => ({
        path: r.file,
        section: "search",
        name: r.file.split("/").pop()?.replace(/\.md$/, "") ?? r.file,
      })) || [],
    )
  }, [rootParam, fetchDocs])

  async function handleDocSelect(path: string) {
    if (isDirtyRef.current && !window.confirm(t("docs.unsavedDiscard"))) return
    isDirtyRef.current = false
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(path)}`)
    const data = await res.json()
    setSelectedDoc(data)
    if (apiOpen) openApi(null)
  }

  // ?doc=path (Copy link) opens that doc once on arrival
  const openedLinkRef = useRef(false)
  useEffect(() => {
    if (openedLinkRef.current || !activeProject) return
    openedLinkRef.current = true
    const linked = new URLSearchParams(window.location.search).get("doc")
    if (!linked) return
    fetch(`/api/docs${rootParam}&read=${encodeURIComponent(linked)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.path) setSelectedDoc(d) })
      .catch(() => {})
  }, [activeProject, rootParam, setSelectedDoc])

  async function handleDocCreated(path: string) {
    fetchDocs()
    await handleDocSelect(path)
  }

  function handleDirtyChange(dirty: boolean) {
    isDirtyRef.current = dirty
  }

  function handleSearchChange(value: string) {
    setDocSearch(value)
    searchDocsFn(value)
  }

  function handleDocDeleted(path: string) {
    fetchDocs()
    if (selectedDoc?.path === path) {
      setSelectedDoc(null)
    }
  }

  async function handleDocRenamed(oldPath: string, newPath: string) {
    fetchDocs()
    if (selectedDoc?.path === oldPath) {
      await handleDocSelect(newPath)
    }
  }

  async function renameTo(oldPath: string, newPath: string): Promise<string | null> {
    const err = await send(`/api/docs${rootParam}`, "PATCH", { oldPath, newPath })
    if (!err) await handleDocRenamed(oldPath, newPath)
    return err
  }

  // R087: the doc as agents get it (agent-only notes in, human-only blocks out), same URL an agent fetches
  const mdUrl = (path: string) => `/md/${path.split("/").map(encodeURIComponent).join("/")}${rootParam === "?" ? "" : rootParam}`

  const docActions: DocActions = {
    rename: (path) => setPathDialog({ mode: "rename", path }),
    move: (path) => setPathDialog({ mode: "move", path }),
    duplicate: async (path) => {
      const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(path)}`)
      const { content } = await res.json()
      const stem = path.replace(/\.md$/, "")
      // first free name: x-copy.md, x-copy-2.md, …
      for (let n = 1; n < 50; n++) {
        const target = `${stem}-copy${n > 1 ? `-${n}` : ""}.md`
        const err = await send(`/api/docs${rootParam}`, "POST", { path: target, content })
        if (!err) return handleDocCreated(target)
        if (err !== "File already exists") return toast(err)
      }
    },
    copyPath: (path) => { navigator.clipboard.writeText(path) },
    copyLink: (path) => { navigator.clipboard.writeText(`${window.location.origin}/docs?doc=${encodeURIComponent(path)}`) },
    chat: (path) => askAgent(`Let's talk about ${path}. Read it first with vibedoc_read_doc.`, { newChat: true }),
    copyPage: async (path) => {
      const res = await fetch(mdUrl(path))
      if (!res.ok) return toast((await res.text()).trim())
      await navigator.clipboard.writeText(await res.text())
      toast(t("docs.pageCopied"))
    },
    viewMarkdown: (path) => { window.open(mdUrl(path), "_blank", "noopener") },
    copyAgentLink: (path) => { navigator.clipboard.writeText(`${window.location.origin}${mdUrl(path)}`) },
    remove: async (path) => {
      const wasOpen = selectedDoc?.path === path
      const res = await fetch(`/api/docs${rootParam}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) })
      const data = await res.json().catch(() => null)
      if (!res.ok) return toast(data?.error ?? t("docs.deleteFailed"))
      handleDocDeleted(path)
      undoToast(t("docs.deletedPath", { path }), async () => {
        const err = await send(`/api/docs${rootParam}`, "POST", { path, content: data.content })
        if (err) throw new Error(err)
        if (wasOpen) await handleDocCreated(path)
        else fetchDocs()
      })
    },
  }

  return (
    <>
      <DocPathDialog
        mode={pathDialog?.mode ?? null}
        path={pathDialog?.path ?? ""}
        onSubmit={(newPath) => renameTo(pathDialog?.path ?? "", newPath)}
        onClose={() => setPathDialog(null)}
      />
      <DocsTab
        docActions={demo ? undefined : docActions}
        docs={docs}
        selectedDoc={selectedDoc}
        docSearch={docSearch}
        onSearchChange={handleSearchChange}
        onDocSelect={handleDocSelect}
        onDirtyChange={handleDirtyChange}
        onNewDocClick={demo ? undefined : () => setNewDocOpen(true)}
        onDocDeleted={handleDocDeleted}
        onDocRenamed={handleDocRenamed}
        rootParam={rootParam}
        apiSpec={apiSpec}
        apiOpen={apiOpen}
        onApiOpen={openApi}
      />
      <NewDocModal
        open={newDocOpen}
        onOpenChange={setNewDocOpen}
        rootParam={rootParam}
        onDocCreated={handleDocCreated}
      />
    </>
  )
}
