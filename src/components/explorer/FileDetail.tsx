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
import { firstProseParagraph, inlineParts, plainInline } from "@/lib/describe"
import { LinkedDocs } from "@/components/docs/LinkedDocs"
import { useDocLinks } from "@/components/docs/useDocLinks"

const LABEL_CAPS = "font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted"
// ISO-like day for English (2026-10-23), the language's own short date otherwise
const DAY: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }

/** The file's first prose paragraph, read through GET /api/docs?read= (null while loading, '' when it has none). */
function useFirstParagraph(path: string | undefined): string | null {
  const { rootParam } = useApp()
  const [data, setData] = useState<{ path: string; text: string } | null>(null)
  useEffect(() => {
    if (!path) return
    const ctrl = new AbortController()
    fetch(`/api/docs${rootParam}&read=${encodeURIComponent(path)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { content?: string } | null) => setData({ path, text: firstProseParagraph(d?.content ?? "") }))
      .catch((e: Error) => {
        if (e.name === "AbortError") return
        console.warn("Reading the file for its first paragraph failed", e)
        setData({ path, text: "" })
      })
    return () => ctrl.abort()
  }, [path, rootParam])
  return path && data?.path === path ? data.text : null
}

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
  const paragraph = useFirstParagraph(file?.path)
  const links = useDocLinks(file?.path)

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

      <p className={cn("max-w-prose text-sm leading-relaxed transition-colors duration-500", flashGreen ? "text-teal" : "text-txt")}>
        {file.description ? <InlineMarkdown text={file.description} /> : (
          <span className="text-muted italic">
            {t("docs.noDescriptionYet")}
          </span>
        )}
      </p>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <Badge variant={SOURCE_VARIANT[file.source]} className="text-[10px]">
          {t(SOURCE_LABEL[file.source])}
        </Badge>
        <span>{t("docs.updatedOn", { date: f.date(file.updatedAt, DAY, "en-CA") })}</span>
        <span>{t("docs.modifiedOn", { date: f.date(file.mtime, DAY, "en-CA") })}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenDoc(file.path)}>
          <ExternalLink className="w-3 h-3 mr-1.5" />
          {t("docs.openInDocs")}
        </Button>
        {!demo && <Button variant="ghost" size="sm" onClick={handleEnrich} disabled={enriching}>
          <RefreshCw className={`w-3 h-3 mr-1.5 ${enriching ? "animate-spin" : ""}`} />
          {t("docs.reEnrich")}
        </Button>}
      </div>

      {/* what the file says, not just its one-line description; skipped when it is the description */}
      {paragraph && paragraph !== plainInline(file.description) && (
        <section className="flex max-w-prose flex-col gap-1.5 border-t border-border pt-4">
          <h3 className={LABEL_CAPS}>{t("docs.fromTheFile")}</h3>
          <p data-user-content data-first-paragraph className="text-sm leading-relaxed text-txt/90">{paragraph}</p>
        </section>
      )}

      <section className="flex max-w-prose flex-col gap-2 border-t border-border pt-4">
        <h3 className={LABEL_CAPS}>{t("docs.linkedDocs")}</h3>
        <LinkedDocs links={links} path={file.path} />
      </section>
    </div>
  )
}
