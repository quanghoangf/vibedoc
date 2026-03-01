"use client"

import type { Task } from "@/types"

interface TaskDetailPanelProps {
  task: Task | null
  onClose: () => void
  onMove: (id: string, status: string) => void
}

// Placeholder for T003 — full slide-in panel implementation
export function TaskDetailPanel({ task, onClose, onMove }: TaskDetailPanelProps) {
  if (!task) return null
  return null
}
