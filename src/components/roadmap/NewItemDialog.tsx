"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useT } from "@/context/LanguageContext"

interface NewItemDialogProps {
  open: boolean
  heading: string
  onOpenChange: (open: boolean) => void
  /** Returns an error message to show, or null on success. */
  onSubmit: (title: string) => Promise<string | null>
}

export function NewItemDialog({ open, heading, onOpenChange, onSubmit }: NewItemDialogProps) {
  const { t } = useT()
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close(v: boolean) {
    if (!v) {
      setTitle("")
      setError(null)
    }
    onOpenChange(v)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const err = await onSubmit(title.trim())
    setBusy(false)
    if (err) setError(err)
    else close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">{heading}</DialogTitle>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("board.title")}
            className="bg-bg border-border text-txt"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => close(false)}>
              {t("board.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !title.trim()} className="bg-accent text-accent-fg hover:bg-accent/90">
              {t("roadmap.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
