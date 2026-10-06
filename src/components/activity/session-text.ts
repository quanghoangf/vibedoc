"use client"

import { useCallback } from "react"
import { useT } from "@/context/LanguageContext"
import type { Session } from "@/types"

/**
 * A session's headline in the UI language (R078), built from its data like lib/sessions.ts builds the English one
 * for MCP: "3 tasks moved (1 done) · 2 docs changed · 1 ADR · 1 roadmap edit · memory updated", else "N events".
 */
export function useSessionHeadline(): (s: Session) => string {
  const { t, tn } = useT()
  return useCallback((s: Session) => {
    const done = s.tasks.filter((x) => x.lastStatus === "done").length
    const parts = [
      s.tasks.length ? `${tn("memory.hTasksMoved", s.tasks.length)}${done ? ` ${t("memory.hDoneSuffix", { n: done })}` : ""}` : "",
      s.docs.length ? tn("memory.hDocsChanged", s.docs.length) : "",
      s.decisions.length ? tn("memory.hAdrs", s.decisions.length) : "",
      s.roadmapEdits ? tn("memory.hRoadmapEdits", s.roadmapEdits) : "",
      s.memoryUpdated ? t("memory.hMemoryUpdated") : "",
    ].filter(Boolean)
    return parts.join(" · ") || tn("memory.events", s.eventCount)
  }, [t, tn])
}
