"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { Brain, FileText, ListTodo, Map, type LucideIcon } from "lucide-react"
import { projectHref, useApp } from "@/context/AppContext"
import { hitHref, type CrossGroup, type CrossKind, type CrossResult } from "@/lib/cross-search"
import type { MessageKey } from "@/i18n"

export const KIND_ICON: Record<CrossKind, LucideIcon> = { doc: FileText, task: ListTodo, epic: Map, entry: Brain }
export const KIND_LABEL: Record<CrossKind, MessageKey> = { doc: "search.kindDoc", task: "search.kindTask", epic: "search.kindEpic", entry: "search.kindEntry" }

/** GET /api/search (R107): results grouped by project. Throws on a non-2xx with the server's error. */
export async function fetchSearch(q: string, scope: string, signal?: AbortSignal): Promise<CrossGroup[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(scope)}`, { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok || !Array.isArray(data)) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

/** Opens a result in its own project: in place for the open one, else a fresh load of that project. */
export function useOpenResult(): (r: CrossResult) => void {
  const router = useRouter()
  const { projects, activeProjectId, withProject, openDoc } = useApp()
  return useCallback((r: CrossResult) => {
    if (r.project.id === activeProjectId) {
      if (r.kind === "doc") void openDoc(r.path)
      else router.push(withProject(hitHref(r)))
      return
    }
    // ponytail: a full load, so every page reads its deep link (?doc=, ?task=…) on arrival in the other project;
    // an in-app switch would need each page to re-read its link on a project change
    window.location.assign(projectHref(hitHref(r), r.project.id, projects[0]?.id))
  }, [activeProjectId, openDoc, router, withProject, projects])
}
