"use client"

import { useState } from "react"
import { Bot, ClipboardCopy, Copy, CopyPlus, FileCode2, FolderInput, Link2, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { itemKeyLabel } from "@/components/shared/item-commands"
import { useT } from "@/context/LanguageContext"

/** What the docs page does for each entry; the menu holds no state. */
export interface DocActions {
  rename: (path: string) => void
  move: (path: string) => void
  duplicate: (path: string) => void
  copyPath: (path: string) => void
  copyLink: (path: string) => void
  chat: (path: string) => void
  /** R087: the doc as an agent reads it, to the clipboard */
  copyPage: (path: string) => void
  /** R087: open /md/<path> */
  viewMarkdown: (path: string) => void
  /** R087: the /md/<path> URL, to the clipboard */
  copyAgentLink: (path: string) => void
  remove: (path: string) => void
}

export function DocMenuItems({ path, actions }: { path: string; actions: DocActions }) {
  const { t } = useT()
  return (
    <>
      <DropdownMenuItem onSelect={() => actions.rename(path)}><Pencil /> {t("docs.rename")}<DropdownMenuShortcut>{itemKeyLabel("edit")}</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.move(path)}><FolderInput /> {t("docs.moveToFolder")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.duplicate(path)}><CopyPlus /> {t("docs.duplicate")}<DropdownMenuShortcut>{itemKeyLabel("duplicate")}</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => actions.copyPath(path)}><Copy /> {t("docs.copyPath")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.copyLink(path)}><Link2 /> {t("docs.copyLink")}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => actions.copyPage(path)}><ClipboardCopy /> {t("docs.copyPage")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.viewMarkdown(path)}><FileCode2 /> {t("docs.viewAsMarkdown")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.copyAgentLink(path)}><Bot /> {t("docs.copyAgentLink")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.chat(path)}><MessageSquare /> {t("docs.chatAboutDoc")}<DropdownMenuShortcut>{itemKeyLabel("chat")}</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => actions.remove(path)} className="text-danger focus:text-danger"><Trash2 /> {t("board.delete")}<DropdownMenuShortcut>{itemKeyLabel("remove")}</DropdownMenuShortcut></DropdownMenuItem>
    </>
  )
}

/** ⋯ button with the doc's actions. Pass open/onOpenChange to also open it from a right-click. */
export function DocActionsMenu({ path, actions, open, onOpenChange, className }: {
  path: string
  actions: DocActions
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  const { t } = useT()
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("board.actionsFor", { id: path })}
          onClick={(e) => e.stopPropagation()}
          className={cn("grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt", className)}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DocMenuItems path={path} actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const dirOf = (p: string) => p.split("/").slice(0, -1).join("/")
const baseOf = (p: string) => p.split("/").pop() ?? p

/** Rename (file name) or move (folder); both end up as a new path. */
export function DocPathDialog({ mode, path, onSubmit, onClose }: {
  mode: "rename" | "move" | null
  path: string
  /** Returns an error message, or null on success. */
  onSubmit: (newPath: string) => Promise<string | null>
  onClose: () => void
}) {
  return (
    <Dialog open={!!mode} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md bg-surface border-border">
        {mode && <PathForm key={`${mode}:${path}`} mode={mode} path={path} onSubmit={onSubmit} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function PathForm({ mode, path, onSubmit, onClose }: { mode: "rename" | "move"; path: string; onSubmit: (newPath: string) => Promise<string | null>; onClose: () => void }) {
  const [value, setValue] = useState(mode === "rename" ? baseOf(path).replace(/\.md$/, "") : dirOf(path))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { t } = useT()

  const clean = value.trim().replace(/^\/+|\/+$/g, "")
  const newPath = mode === "rename"
    ? [dirOf(path), clean && `${clean.replace(/\.md$/, "")}.md`].filter(Boolean).join("/")
    : [clean, baseOf(path)].filter(Boolean).join("/")
  const invalid = (mode === "rename" && (!clean || clean.includes("/"))) || newPath === path

  async function submit() {
    if (invalid) return
    setBusy(true)
    setError(null)
    const err = await onSubmit(newPath)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle className="text-txt">{mode === "rename" ? t("docs.renameDoc") : t("docs.moveToFolder")}</DialogTitle>
      </DialogHeader>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {mode === "rename" ? t("docs.name") : t("docs.folderHint")}
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "move" ? "docs/guides" : undefined} className="bg-bg border-border text-txt" />
      </label>
      <p className="font-mono text-[11px] text-muted truncate" title={newPath}>→ {newPath || "—"}</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>{t("board.cancel")}</Button>
        <Button type="submit" size="sm" disabled={busy || invalid} className="bg-accent text-accent-fg hover:bg-accent/90">
          {mode === "rename" ? t("docs.rename") : t("docs.move")}
        </Button>
      </div>
    </form>
  )
}
