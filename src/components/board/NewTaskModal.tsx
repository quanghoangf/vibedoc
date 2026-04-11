"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rootParam: string
  onTaskCreated: () => void
}

const SIZE_OPTIONS = [
  { value: "XS (< 1 hr)", label: "XS — under 1 hr" },
  { value: "S (1-2 hrs)", label: "S — 1–2 hrs" },
  { value: "M (3-4 hrs)", label: "M — 3–4 hrs" },
  { value: "L (5-8 hrs)", label: "L — 5–8 hrs" },
  { value: "XL (> 1 day)", label: "XL — over a day" },
]

export function NewTaskModal({ open, onOpenChange, rootParam, onTaskCreated }: NewTaskModalProps) {
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
    if (!title.trim()) { setError("Title is required"); return }

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
        setError(data.error ?? "Failed to create task")
        setCreating(false)
        return
      }

      setCreating(false)
      onTaskCreated()
      onOpenChange(false)
    } catch {
      setError("Network error — please try again")
      setCreating(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-txt">New Task</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-txt transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                Title <span className="text-danger">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Add drag-and-drop to kanban"
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wide">Phase</label>
                <input
                  type="text"
                  value={phase}
                  onChange={e => setPhase(e.target.value)}
                  placeholder="e.g. 1 — Core"
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wide">Size</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="">—</option>
                  {SIZE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Depends on</label>
              <input
                type="text"
                value={dependsOn}
                onChange={e => setDependsOn(e.target.value)}
                placeholder="e.g. T001, T003"
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What needs to be built?"
                rows={3}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
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
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
