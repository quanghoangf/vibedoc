"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/context/AppContext"
import { DocsTab } from "@/components/docs/DocsTab"
import { NewDocModal } from "@/components/docs/NewDocModal"
import { DocPathDialog, type DocActions } from "@/components/docs/DocActionsMenu"
import { askAgent } from "@/lib/ask-agent"
import { toast, undoToast } from "@/components/ui/toast"
import type { DocFile } from "@/types"

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) return null
    return (await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`
  } catch {
    return "Could not reach the server"
  }
}

export default function DocsPage() {
  const { selectedDoc, setSelectedDoc, rootParam, activeProject } = useApp()
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
    if (isDirtyRef.current && !window.confirm("You have unsaved changes. Discard?")) return
    isDirtyRef.current = false
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(path)}`)
    const data = await res.json()
    setSelectedDoc(data)
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
    chat: (path) => askAgent(`Let's talk about ${path}. Read it first.`, { newChat: true }),
    remove: async (path) => {
      const wasOpen = selectedDoc?.path === path
      const res = await fetch(`/api/docs${rootParam}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) })
      const data = await res.json().catch(() => null)
      if (!res.ok) return toast(data?.error ?? "Delete failed")
      handleDocDeleted(path)
      undoToast(`Deleted ${path}`, async () => {
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
        docActions={docActions}
        docs={docs}
        selectedDoc={selectedDoc}
        docSearch={docSearch}
        onSearchChange={handleSearchChange}
        onDocSelect={handleDocSelect}
        onDirtyChange={handleDirtyChange}
        onNewDocClick={() => setNewDocOpen(true)}
        onDocDeleted={handleDocDeleted}
        onDocRenamed={handleDocRenamed}
        rootParam={rootParam}
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
