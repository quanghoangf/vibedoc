"use client"

import { useT } from "@/context/LanguageContext"

/** ownerLabel() of src/lib/owner.ts in the UI language: "Human" / "No owner" translated, an agent keeps its name. */
export function useOwnerLabel(): (owner: string | null) => string {
  const { t } = useT()
  return (owner) => (owner === "human" ? t("board.human") : owner?.startsWith("ai:") ? owner.slice(3) : t("board.noOwner"))
}
