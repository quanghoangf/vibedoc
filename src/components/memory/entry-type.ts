"use client"

import { useT } from "@/context/LanguageContext"
import type { EntryType } from "@/lib/entries"
import type { MessageKey } from "@/i18n"

const KEY: Record<EntryType, MessageKey> = {
  convention: "memory.typeConvention",
  gotcha: "memory.typeGotcha",
  decision: "memory.typeDecision",
  preference: "memory.typePreference",
}

/** An entry type's name in the UI language (the file keeps the English id). */
export function useEntryTypeLabel(): (type: EntryType) => string {
  const { t } = useT()
  return (type) => (KEY[type] ? t(KEY[type]) : type)
}
