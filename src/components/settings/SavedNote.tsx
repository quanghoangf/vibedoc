"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"

/** "Saved" under an autosave section's title for 2 s after each save (`at` = when). Its line is reserved: nothing shifts. */
export function SavedNote({ at }: { at: number | null }) {
  const { t } = useT()
  const [gone, setGone] = useState<number | null>(null)
  useEffect(() => {
    if (at == null) return
    const id = setTimeout(() => setGone(at), 2000)
    return () => clearTimeout(id)
  }, [at])
  const visible = at != null && gone !== at
  return (
    <p role="status" data-saved-note className={cn("mt-1 flex h-4 items-center gap-1 text-xs text-muted transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}>
      {visible && <><Check className="size-3" aria-hidden />{t("settings.saved")}</>}
    </p>
  )
}
