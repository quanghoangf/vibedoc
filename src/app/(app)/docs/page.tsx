"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/context/AppContext"
import { DocsTab } from "@/components/docs/DocsTab"
import { NewDocModal } from "@/components/docs/NewDocModal"
import type { DocFile } from "@/types"

export default function DocsPage() {
  const { selectedDoc, setSelectedDoc, rootParam, activeProject } = useApp()
  const [docs, setDocs] = useState<DocFile[]>([])
  const [docSearch, setDocSearch] = useState("")
  const [newDocOpen, setNewDocOpen] = useState(false)
  const isDirtyRef = useRef(false)

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
        name: r.file,
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

  return (
    <>
      <DocsTab
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
