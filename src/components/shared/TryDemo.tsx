"use client"

import { CommandRow } from "@/components/layout/DemoBanner"
import { useT } from "@/context/LanguageContext"

/**
 * "Try the demo" (R085): the `vibedoc --demo` command with a copy button. A seam for R082's welcome screen, which
 * renders it; nothing else does yet.
 */
export function TryDemo() {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-txt">{t("shell.tryDemo")}</p>
      <p className="text-xs text-muted">{t("shell.tryDemoBody")}</p>
      <CommandRow command="npx vibedoc --demo" />
    </div>
  )
}
