"use client"

import { usePathname } from "next/navigation"
import { useT } from "@/context/LanguageContext"
import { Skeleton } from "@/components/ui/skeleton"

/** Pages that are a list of rows; the board gets columns, everything else a title and two lines. */
const LIST_PAGES = ["/activity", "/inbox", "/manual-tests", "/memory", "/docs", "/chat", "/search", "/projects"]

/**
 * The page body while its data loads. The shell (sidebar, header) is already on screen, so this
 * stays quiet: muted bars in the page's own shape (board columns, list rows, else a title), the
 * words only for screen readers. Used by the (app) layout on the first load and by pages with their
 * own fetch (roadmap), so both look like one wait.
 */
export function LoadingScreen() {
  const { t } = useT()
  const pathname = usePathname()
  const shape = pathname.startsWith("/board") ? "board" : LIST_PAGES.some((p) => pathname.startsWith(p)) ? "list" : "page"
  return (
    <div role="status" aria-busy="true" data-page-skeleton={shape} className="flex-1 px-4 pt-8 sm:px-8 motion-reduce:[&_*]:animate-none">
      <span className="sr-only">{t("help.loadingProject")}</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      {shape === "board" && (
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[3, 2, 1, 2].map((n, i) => (
            <div key={i} className={i > 1 ? "space-y-2 max-md:hidden" : "space-y-2"}>
              <Skeleton className="h-3 w-20" />
              {Array.from({ length: n }, (_, j) => <Skeleton key={j} className="h-16" />)}
            </div>
          ))}
        </div>
      )}
      {shape === "list" && (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}
        </div>
      )}
    </div>
  )
}
