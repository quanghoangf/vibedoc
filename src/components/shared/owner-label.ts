"use client"

import { useCallback } from "react"
import { useT } from "@/context/LanguageContext"
import { useChatsOptional } from "@/context/ChatContext"
import { workerOwner } from "@/lib/owner"

/**
 * ownerLabel() of src/lib/owner.ts in the UI language: "Human" / "No owner" translated, an agent keeps its name,
 * a worker (`ai:worker-<chatId>`, R108) reads "Worker · R108" or "Agent worker (removed)", never its raw id.
 */
export function useOwnerLabel(): (owner: string | null) => string {
  const { t } = useT()
  const api = useChatsOptional()
  const chats = api?.chats
  // until the chats load, a worker is just "Worker" (not "removed")
  const known = !!api?.loaded
  return useCallback((owner: string | null) => {
    const w = workerOwner(owner, chats ?? [])
    if (w) return w.removed && known ? t("board.workerOwnerRemoved") : w.target ? t("board.workerOwner", { target: w.target }) : t("board.workerOwnerBare")
    return owner === "human" ? t("board.human") : owner?.startsWith("ai:") ? owner.slice(3) : t("board.noOwner")
  }, [t, chats, known])
}
