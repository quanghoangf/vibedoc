"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { ExplorerTab } from "@/components/explorer/ExplorerTab"
import type { ExplorerFile } from "@/types"

function ExplorerContent() {
  const { rootParam, activeProject, openDoc } = useApp()
  const searchParams = useSearchParams()
  const view = (searchParams.get("view") as "tree" | "treemap" | "heatmap") || "tree"
  const [files, setFiles] = useState<ExplorerFile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/explorer${rootParam}`)
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [rootParam])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  function handleEnriched(path: string, description: string) {
    setFiles((prev) =>
      prev.map((f) =>
        f.path === path
          ? { ...f, description, source: "ai" as const, updatedAt: new Date().toISOString() }
          : f
      )
    )
  }

  return (
    <ExplorerTab
      files={files}
      loading={loading}
      view={view}
      root={activeProject}
      onEnriched={handleEnriched}
      onOpenDoc={openDoc}
    />
  )
}

export default function ExplorerPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        }
      >
        <ExplorerContent />
      </Suspense>
    </div>
  )
}
