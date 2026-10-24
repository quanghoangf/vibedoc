"use client"

import { useState, useEffect } from "react"
import { FileText, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ExplorerFile } from "@/types"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { inlineParts } from "@/lib/describe"

/** A description's inline markdown as React nodes (`code`, **strong**, *em*, links); never injected HTML. */
function InlineMarkdown({ text }: { text: string }) {
  return inlineParts(text).map((p, i) =>
    p.kind === "code" ? <code key={i} className="rounded-sm bg-surface2 px-1 font-mono text-[0.9em]">{p.text}</code>
      : p.kind === "strong" ? <strong key={i} className="font-semibold">{p.text}</strong>
      : p.kind === "em" ? <em key={i}>{p.text}</em>
      : p.kind === "link" ? (/^https?:\/\//.test(p.href)
        ? <a key={i} href={p.href} target="_blank" rel="noreferrer" className="text-accent-edge underline underline-offset-2">{p.text}</a>
        : <span key={i}>{p.text}</span>)
      : <span key={i}>{p.text}</span>,
  )
}

const SOURCE_LABEL: Record<ExplorerFile['source'], MessageKey> = { ai: 'docs.sourceAi', extracted: 'docs.sourceAuto' }
const SOURCE_VARIANT: Record<ExplorerFile['source'], 'default' | 'secondary'> = { ai: 'default', extracted: 'secondary' }

interface FileDetailProps {
  file: ExplorerFile | null
  root: string
  onEnriched: (path: string, description: string) => void
  onOpenDoc: (path: string) => Promise<void>
}

export function FileDetail({ file, root, onEnriched, onOpenDoc }: FileDetailProps) {
  const { demo } = useApp()
  const f = useFormat()
  const { t } = useT()
  const [enriching, setEnriching] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEnriching(false)
    setFlashGreen(false)
    setError(null)
  }, [file?.path])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        {t("docs.selectFile")}
      </div>
    )
  }

  const parts = file.path.split("/")

  async function handleEnrich() {
    setEnriching(true)
    setError(null)
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
      } else {
        setError(data.error ?? t('docs.enrichFailed'))
      }
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-auto">
      <div data-user-content className="flex items-center gap-1.5 font-mono text-[11px] text-muted flex-wrap">
        <FileText className="w-3.5 h-3.5 shrink-0" />
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted">/</span>}
            <span className={i === parts.length - 1 ? "text-txt font-medium" : ""}>
              {part}
            </span>
          </span>
        ))}
      </div>

      <p className={cn("text-sm leading-relaxed transition-colors duration-500", flashGreen ? "text-teal" : "text-txt")}>
        {file.description ? <InlineMarkdown text={file.description} /> : (
          <span className="text-muted italic">
            {t("docs.noDescriptionYet")}
          </span>
        )}
      </p>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted">
        <Badge variant={SOURCE_VARIANT[file.source]} className="text-[10px]">
          {t(SOURCE_LABEL[file.source])}
        </Badge>
        <span>{t("docs.updatedOn", { date: f.date(file.updatedAt, { dateStyle: "short" }) })}</span>
        <span className="ml-auto">{t("docs.modifiedOn", { date: f.date(file.mtime, { dateStyle: "short" }) })}</span>
      </div>

      <div className="flex gap-2 pt-2">
        {!demo && <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
          <RefreshCw className={`w-3 h-3 mr-1.5 ${enriching ? "animate-spin" : ""}`} />
          {t("docs.reEnrich")}
        </Button>}
        <Button variant="outline" size="sm" onClick={() => onOpenDoc(file.path)}>
          <ExternalLink className="w-3 h-3 mr-1.5" />
          {t("docs.openInDocs")}
        </Button>
      </div>
    </div>
  )
}
