"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"

interface NewTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rootParam: string
  onTaskCreated: () => void
}

// The value is written to the task file as is (English, like every **Key:** line); only the label is translated
const SIZE_OPTIONS: { value: string; label: MessageKey }[] = [
  { value: "XS (< 1 hr)", label: "board.sizeXS" },
  { value: "S (1-2 hrs)", label: "board.sizeS" },
  { value: "M (3-4 hrs)", label: "board.sizeM" },
  { value: "L (5-8 hrs)", label: "board.sizeL" },
  { value: "XL (> 1 day)", label: "board.sizeXL" },
]

export function NewTaskModal({ open, onOpenChange, rootParam, onTaskCreated }: NewTaskModalProps) {
  const { t } = useT()
  const [title, setTitle] = useState("")
  const [phase, setPhase] = useState("")
  const [size, setSize] = useState("")
  const [description, setDescription] = useState("")
  const [dependsOn, setDependsOn] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle("")
      setPhase("")
      setSize("")
      setDescription("")
      setDependsOn("")
      setError("")
      setCreating(false)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError(t("board.titleRequired")); return }

    setCreating(true)
    setError("")

    try {
      const res = await fetch(`/api/tasks/create${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          phase: phase.trim() || undefined,
          size: size || undefined,
          description: description.trim() || undefined,
          dependsOn: dependsOn.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? t("board.createFailed"))
        setCreating(false)
        return
      }

      setCreating(false)
      onTaskCreated()
      onOpenChange(false)
    } catch {
      setError(t("board.networkError"))
      setCreating(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-txt">{t("board.newTaskDialog")}</Dialog.Title>
            <Dialog.Close aria-label={t("board.close")} className="text-muted hover:text-txt transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide">
                {t("board.title")} <span className="text-danger">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t("board.titlePlaceholder")}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted uppercase tracking-wide">{t("board.phase")}</label>
                <input
                  type="text"
                  value={phase}
                  onChange={e => setPhase(e.target.value)}
                  placeholder={t("board.phasePlaceholder")}
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted uppercase tracking-wide">{t("board.size")}</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt focus:outline-hidden focus:border-accent transition-colors"
                >
                  <option value="">—</option>
                  {SIZE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{t(o.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide">{t("board.dependsOn")}</label>
              <input
                type="text"
                value={dependsOn}
                onChange={e => setDependsOn(e.target.value)}
                placeholder={t("board.dependsOnPlaceholder")}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide">{t("board.description")}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t("board.descriptionPlaceholder")}
                rows={3}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close
                type="button"
                className="px-4 py-2 text-sm text-muted hover:text-txt transition-colors"
              >
                {t("board.cancel")}
              </Dialog.Close>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? t("board.creating") : t("board.createTask")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
