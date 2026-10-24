"use client"

import { useT } from "@/context/LanguageContext"
import type { ApproveRisk } from "@/lib/inbox"

/** Approve's label says what it would skip: "Approve", "Approve with 8 unchecked", "Approve despite failed run". */
export function useApproveLabel() {
  const { t, tn } = useT()
  return (risk: ApproveRisk | null | undefined) =>
    !risk ? t("board.approve") : risk.failedRun ? t("board.approveFailedRun") : tn("board.approveUnchecked", risk.unchecked)
}
