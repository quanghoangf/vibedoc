"use client"

import { useState } from "react"
import Link from "next/link"
import { Ban, Eye, ListChecks, MessagesSquare, XCircle, type LucideIcon } from "lucide-react"
import type { InboxItem, InboxKind } from "@/lib/inbox"
import type { MessageKey } from "@/i18n"
import { useFormat, useT } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const KIND_LABEL: Record<InboxKind, MessageKey> = {
  review: "inbox.kindReview",
  "needs-test": "inbox.kindNeedsTest",
  "failed-run": "inbox.kindFailedRun",
  blocked: "inbox.kindBlocked",
  "chat-waiting": "inbox.kindChatWaiting",
}

const KIND_ICON: Record<InboxKind, { icon: LucideIcon; tone: string }> = {
  review: { icon: Eye, tone: "text-accent" },
  "needs-test": { icon: ListChecks, tone: "text-muted" },
  "failed-run": { icon: XCircle, tone: "text-danger" },
  blocked: { icon: Ban, tone: "text-amber" },
  "chat-waiting": { icon: MessagesSquare, tone: "text-amber" },
}

interface InboxRowProps {
  item: InboxItem
  /** Review rows only: approve, or send back with a note. Absent = no inline actions (demo). */
  onApprove?: () => void
  onSendBack?: (note: string) => void
}

/** One waiting item: kind, title, project chip and age; the row opens it in its project, review rows decide inline. */
export function InboxRow({ item, onApprove, onSendBack }: InboxRowProps) {
  const { t } = useT()
  const f = useFormat()
  const [note, setNote] = useState<string | null>(null)
  const { icon: Icon, tone } = KIND_ICON[item.kind]
  const kind = t(KIND_LABEL[item.kind])
  const review = item.kind === "review" && onApprove && onSendBack

  return (
    <li data-inbox-row={`${item.project.id}/${item.id}`} className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={item.href} className="group flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-accent">
          <Icon aria-hidden className={cn("size-4 shrink-0", tone)} />
          <span className="sr-only">{kind}: </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-txt group-hover:underline">
              <span className="font-mono text-xs text-muted">{item.id.startsWith("c-") ? "" : `${item.id} `}</span>
              <span data-user-content>{item.title}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span aria-hidden>{kind}</span>
              <span data-user-content className="max-w-48 truncate rounded-sm border border-border px-1.5 font-mono text-[11px] text-txt">{item.project.name}</span>
              {item.since && <span>{f.timeAgo(item.since)}</span>}
            </span>
          </span>
        </Link>
        {review && note === null && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={onApprove}>{t("inbox.approve")}</Button>
            <Button size="sm" variant="outline" onClick={() => setNote("")}>{t("inbox.sendBack")}</Button>
          </div>
        )}
      </div>
      {review && note !== null && (
        <form
          className="mt-2 flex flex-wrap gap-2 pl-7"
          onSubmit={(e) => { e.preventDefault(); if (note.trim()) onSendBack(note.trim()) }}
        >
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setNote(null) }}
            aria-label={t("inbox.sendBackNote")}
            placeholder={t("inbox.sendBackNote")}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-txt placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button size="sm" type="submit" disabled={!note.trim()}>{t("inbox.sendBackSubmit")}</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setNote(null)}>{t("inbox.cancel")}</Button>
        </form>
      )}
    </li>
  )
}
