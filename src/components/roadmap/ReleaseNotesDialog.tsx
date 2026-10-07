"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { ProposalCard } from "@/components/chat/ProposalCard"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { ReleaseNotesDraft } from "@/lib/core"

/**
 * R091: done work since the last tag as a `# Unreleased` section of CHANGELOG.md, shown as the chat's propose-edit
 * diff. Accept writes it through PUT /api/docs (re-applied to the file as it is then); closing writes nothing.
 */
export function ReleaseNotesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { rootParam } = useApp()
  const { t } = useT()
  const [draft, setDraft] = useState<ReleaseNotesDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    fetch(`/api/release-notes${rootParam}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? t("board.requestFailed", { status: r.status })); return d })
      .then((d) => { if (live) { setDraft(d); setError(null) } })
      .catch((e) => { if (live) setError((e as Error).message) })
    return () => { live = false; setDraft(null) }
  }, [open, rootParam, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">{t("roadmap.releaseNotesTitle")}</DialogTitle>
        <DialogDescription className="text-xs text-muted">
          {draft?.since
            ? t("roadmap.releaseNotesSince", { tag: draft.since.tag, date: draft.since.date, path: draft.path })
            : t("roadmap.releaseNotesNoTag", { path: draft?.path ?? "CHANGELOG.md" })}
        </DialogDescription>
        {!draft && !error && <p className="text-xs text-muted">{t("roadmap.loading")}</p>}
        {draft?.count === 0 && <p className="text-xs text-muted">{t("roadmap.releaseNotesEmpty")}</p>}
        {draft && draft.count > 0 && (
          <ProposalCard
            actor="human"
            proposal={{ id: "release-notes", path: draft.path, edits: draft.edits, status: "pending" }}
            onResolve={(status) => {
              if (status === "accepted") toast(t("roadmap.releaseNotesSaved", { path: draft.path }))
              onOpenChange(false)
            }}
          />
        )}
        {error && <p role="alert" className="whitespace-pre-wrap text-xs text-danger">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
