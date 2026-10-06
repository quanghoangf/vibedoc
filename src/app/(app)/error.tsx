"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useT } from "@/context/LanguageContext"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useT()
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <AlertTriangle className="w-10 h-10 text-amber" />
      <div>
        <p className="font-semibold text-txt">{t("help.somethingWrong")}</p>
        <p data-user-content className="text-sm text-muted mt-1">{error.message || t("help.unexpectedError")}</p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-surface2 border border-border text-txt hover:bg-surface transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t("help.tryAgain")}
      </button>
    </div>
  )
}
