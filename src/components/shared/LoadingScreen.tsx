"use client"

import { useT } from "@/context/LanguageContext"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The page body while its data loads. The shell (sidebar, header) is already on screen, so this
 * stays quiet: a few muted bars, the words only for screen readers. Used by the (app) layout on the
 * first load and by pages with their own fetch (roadmap), so both look like one wait.
 */
export function LoadingScreen() {
  const { t } = useT()
  return (
    <div role="status" aria-busy="true" data-page-skeleton className="flex-1 p-6 space-y-4 motion-reduce:[&_*]:animate-none">
      <span className="sr-only">{t("help.loadingProject")}</span>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-72 max-w-full" />
      <div className="grid gap-3 pt-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  )
}
