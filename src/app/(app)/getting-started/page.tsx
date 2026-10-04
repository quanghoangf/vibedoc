"use client"

import { useEffect, useState } from "react"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"

/** VibeDoc's own guide (docs/getting-started.md in the package), not a doc of the open project (R042). */
export default function GettingStartedPage() {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/docs?guide=getting-started")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { content?: string }) => setContent(d?.content ?? ""))
      .catch(() => setError(true))
  }, [])

  return (
    <article className="mx-auto max-w-3xl px-6 py-8">
      {error ? (
        <p className="text-sm text-muted">Couldn&apos;t load the guide.</p>
      ) : content === null ? (
        <p className="text-sm text-muted" aria-busy="true">Loading…</p>
      ) : (
        <MarkdownRenderer content={content} />
      )}
    </article>
  )
}
