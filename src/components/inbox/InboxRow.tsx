"use client"

import { useState } from "react"
import Link from "next/link"
import { Ban, Eye, ListChecks, MessagesSquare, XCircle, type LucideIcon } from "lucide-react"
import { approveRisk, type InboxItem, type InboxKind } from "@/lib/inbox"
import type { MessageKey } from "@/i18n"
import { useFormat, useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApproveLabel } from "@/components/shared/approve-label"

export const KIND_LABEL: Record<InboxKind, MessageKey> = {
  review: "inbox.kindReview",
  "needs-test": "inbox.kindNeedsTest",
  "failed-run": "inbox.kindFailedRun",
  blocked: "inbox.kindBlocked",
  "chat-waiting": "inbox.kindChatWaiting",
}

const KIND_ICON: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  review: { icon: Eye, tone: "text-review" },
  "needs-test": { icon: ListChecks, tone: "text-muted" },
  "failed-run": { icon: XCircle, tone: "text-danger" },
  blocked: { icon: Ban, tone: "text-amber" },
  "chat-waiting": { icon: MessagesSquare, tone: "text-amber" },
}

interface InboxRowProps {
  item: InboxItem
  /** The keyboard row (j/k): a ring, and a/s act on it */
  focused?: boolean
  onFocus?: () => void
  /** Review rows only: approve, or send back with a note. Absent = no inline actions (demo). */
  onApprove?: () => void
  onSendBack?: (note: string) => void
  /** The send-back note is open; the page owns it so `s` can open it */
  noteOpen?: boolean
  onNoteOpen?: (open: boolean) => void
}

/** "1/7 checks · no run", "failed at step 2 · auto-fix limit reached": what the decision rests on, in mono. */
function useEvidenceText(item: InboxItem): string | null {
  const { t } = useT()
  const e = item.evidence
  if (!e) return null
  const run = e.run === "failed" ? (e.failedStep ? t("inbox.evFailedAt", { n: e.failedStep }) : t("inbox.evFailed")) : e.run === "passed" ? t("inbox.evPassed") : t("inbox.evNoRun")
  return [
    e.checks ? t("inbox.evChecks", { proven: e.checks.proven, total: e.checks.total }) : t("inbox.evNoChecks"),
    run,
    e.autoFixLimit && t("inbox.evFixLimit"),
  ].filter(Boolean).join(" · ")
}

/** One waiting item: kind, title, evidence, project chip and age; the row opens it in its project, review rows decide inline. */
export function InboxRow({ item, focused = false, onFocus, onApprove, onSendBack, noteOpen = false, onNoteOpen }: InboxRowProps) {
  const { t } = useT()
  const f = useFormat()
  const [note, setNote] = useState("")
  const { icon: Icon, tone } = KIND_ICON[item.kind]
  const kind = t(KIND_LABEL[item.kind])
  const review = item.kind === "review" && onApprove && onSendBack
  const evidence = useEvidenceText(item)
  const e = item.evidence
  const close = () => { setNote(""); onNoteOpen?.(false) }
  // One Approve rule (approveRisk, shared with Test review and the task panel): unproven → outline, and the label says what's missing
  const risk = approveRisk(e)
  const approveLabel = useApproveLabel()(risk)
  const named = (action: string) => t("inbox.actionOnTask", { action, id: item.id, title: item.title })

  return (
    <li data-inbox-row={`${item.project.id}/${item.id}`} data-focused={focused || undefined} onFocus={onFocus} className={cn("-mx-2 rounded-md px-2 py-2.5", focused && "bg-surface2/60")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Link href={item.href} className="group flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-accent sm:items-center">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0 sm:mt-0", tone)} />
          <span className="sr-only">{kind}: </span>
          <span className="min-w-0 flex-1">
            {/* phones: the title wraps to two lines instead of losing all but two words */}
            <span className="line-clamp-2 text-sm text-txt group-hover:underline sm:block sm:truncate">
              <span className="font-mono text-xs text-muted">{item.id.startsWith("c-") ? "" : `${item.id} `}</span>
              <span data-user-content>{item.title}</span>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span aria-hidden>{kind}</span>
              {evidence && (
                <span data-inbox-evidence className={cn("font-mono text-[11px]", e?.run === "failed" || e?.autoFixLimit ? "text-danger" : "text-txt")}>
                  <span className="sr-only">{t("inbox.evidence")}: </span>{evidence}
                </span>
              )}
              <span data-user-content className="max-w-48 truncate rounded-sm border border-border px-1.5 font-mono text-[11px] text-txt">{item.project.name}</span>
              {item.since && <span>{f.timeAgo(item.since)}</span>}
            </span>
          </span>
        </Link>
        {review && !noteOpen && (
          <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
            <Button size="sm" variant={risk ? "outline" : "default"} onClick={onApprove} data-inbox-action="approve" aria-label={named(approveLabel)} aria-keyshortcuts={focused ? "a" : undefined}>{approveLabel}</Button>
            <Button size="sm" variant="outline" onClick={() => onNoteOpen?.(true)} data-inbox-action="send-back" aria-label={named(t("inbox.sendBack"))} aria-keyshortcuts={focused ? "s" : undefined}>{t("inbox.sendBack")}</Button>
          </div>
        )}
      </div>
      {review && noteOpen && (
        <form
          className="mt-2 flex flex-wrap gap-2 pl-7"
          onSubmit={(ev) => { ev.preventDefault(); if (note.trim()) { onSendBack(note.trim()); setNote("") } }}
        >
          <input
            autoFocus
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close() } }}
            aria-label={t("inbox.sendBackNote")}
            placeholder={t("inbox.sendBackNote")}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-txt placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button size="sm" type="submit" disabled={!note.trim()}>{t("inbox.sendBackSubmit")}</Button>
          <Button size="sm" type="button" variant="ghost" onClick={close}>{t("inbox.cancel")}</Button>
        </form>
      )}
    </li>
  )
}
