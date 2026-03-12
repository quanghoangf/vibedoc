"use client"

import { useState, useEffect } from "react"
import { FileText, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TEMPLATES, type Template } from "@/lib/templates"

interface NewDocModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rootParam: string
  onDocCreated: (path: string) => void
}

export function NewDocModal({ open, onOpenChange, rootParam, onDocCreated }: NewDocModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<Template | null>(null)
  const [docPath, setDocPath] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(1)
      setSelected(null)
      setDocPath("")
      setError("")
      setCreating(false)
    }
  }, [open])

  function handleSelectTemplate(template: Template) {
    setSelected(template)
    setDocPath(template.defaultPath)
    setError("")
    setStep(2)
  }

  async function handleCreate() {
    if (!selected || !docPath.trim()) return
    setError("")
    setCreating(true)
    try {
      const res = await fetch(`/api/docs${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: docPath.trim(), content: selected.content }),
      })
      if (res.status === 409) {
        setError("File already exists")
        setCreating(false)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to create file")
        setCreating(false)
        return
      }
      onOpenChange(false)
      onDocCreated(docPath.trim())
    } catch {
      setError("Network error")
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-txt text-sm font-semibold">
            {step === 1 ? "Choose a template" : "Confirm file path"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <ScrollArea className="max-h-[420px]">
            <div className="grid grid-cols-3 gap-2 p-1">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 p-3 rounded-lg border border-border text-left",
                    "bg-surface2 hover:bg-surface2/80 hover:border-accent/50 transition-colors",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="text-xs font-medium text-txt">{template.name}</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{template.description}</p>
                  <p className="text-[10px] text-muted/60 font-mono truncate w-full">{template.defaultPath}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {step === 2 && selected && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface2 border border-border">
              <FileText className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-txt">{selected.name}</p>
                <p className="text-[11px] text-muted mt-0.5">{selected.description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted uppercase tracking-wider">File path</label>
              <Input
                autoFocus
                value={docPath}
                onChange={(e) => { setDocPath(e.target.value); setError("") }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
                placeholder="docs/my-document.md"
                className="h-8 text-xs bg-surface2 border-border font-mono"
              />
              {error && <p className="text-[11px] text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="h-7 text-xs text-muted hover:text-txt gap-1.5"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !docPath.trim()}
                className="h-7 text-xs bg-accent hover:bg-accent/90 text-white"
              >
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
