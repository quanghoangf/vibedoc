"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/context/AppContext"
import { DocsTab } from "@/components/docs/DocsTab"
import type { DocFile } from "@/types"

export default function DocsPage() {
  const { selectedDoc, setSelectedDoc, rootParam, activeProject } = useApp()
  const [docs, setDocs] = useState<DocFile[]>([])
  const [docSearch, setDocSearch] = useState("")

  useEffect(() => {
    if (!activeProject) return
    fetch(`/api/docs${rootParam}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [activeProject, rootParam])

  const searchDocsFn = useCallback(async (q: string) => {
    if (!q.trim()) {
      fetch(`/api/docs${rootParam}`)
        .then((r) => r.json())
        .then((d) => setDocs(Array.isArray(d) ? d : []))
        .catch(() => {})
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
  }, [rootParam])

  async function handleDocSelect(path: string) {
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(path)}`)
    const data = await res.json()
    setSelectedDoc(data)
  }

  function handleSearchChange(value: string) {
    setDocSearch(value)
    searchDocsFn(value)
  }

  return (
    <DocsTab
      docs={docs}
      selectedDoc={selectedDoc}
      docSearch={docSearch}
      onSearchChange={handleSearchChange}
      onDocSelect={handleDocSelect}
    />
  )
}
