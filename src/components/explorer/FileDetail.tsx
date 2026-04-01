"use client"

import { useState } from "react"
import { FileText, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ExplorerFile } from "@/types"

interface FileDetailProps {
  file: ExplorerFile | null
  root: string
  onEnriched: (path: string, description: string) => void
  onOpenDoc: (path: string) => Promise<void>
}

export function FileDetail({ file, root, onEnriched, onOpenDoc }: FileDetailProps) {
  const [enriching, setEnriching] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a file to see details
      </div>
    )
  }

  const parts = file.path.split("/")

  async function handleEnrich() {
    setEnriching(true)
    try {
      const res = await fetch("/api/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file!.path, ...(root ? { root } : {}) }),
      })
      const data = await res.json()
      if (res.ok) {
        onEnriched(file!.path, data.description)
        setFlashGreen(true)
        setTimeout(() => setFlashGreen(false), 1500)
      }
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 overflow-auto">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted">/</span>}
            <span className={i === parts.length - 1 ? "text-txt font-medium" : ""}>
              {part}
            </span>
          </span>
        ))}
      </div>

      <p className={`text-sm leading-relaxed transition-colors duration-500 ${flashGreen ? "text-green-400" : "text-txt"}`}>
        {file.description || (
          <span className="text-muted-foreground italic">
            No description yet — click Re-enrich to generate one
          </span>
        )}
      </p>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={file.source === "ai" ? "default" : "secondary"} className="text-[10px]">
          {file.source === "ai" ? "AI" : "Auto"}
        </Badge>
        <span>Updated {new Date(file.updatedAt).toLocaleDateString()}</span>
        <span className="ml-auto">Modified {new Date(file.mtime).toLocaleDateString()}</span>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
          <RefreshCw className={`w-3 h-3 mr-1.5 ${enriching ? "animate-spin" : ""}`} />
          Re-enrich
        </Button>
        <Button variant="outline" size="sm" onClick={() => onOpenDoc(file.path)}>
          <ExternalLink className="w-3 h-3 mr-1.5" />
          Open in Docs
        </Button>
      </div>
    </div>
  )
}
