"use client"

import { useT } from "@/context/LanguageContext"
import type { ApproveRisk } from "@/lib/inbox"

/**
 * Approve's label says everything it would skip: "Approve", "Approve with 8 unchecked",
 * "Approve with 2 findings, 8 unchecked", "Approve despite failed run, 2 findings".
 */
export function useApproveLabel() {
  const { t, tn } = useT()
  return (risk: ApproveRisk | null | undefined) => {
    if (!risk) return t("board.approve")
    const parts = [
      ...(risk.findings > 0 ? [tn("board.findings", risk.findings)] : []),
      ...(risk.unchecked > 0 ? [tn("board.uncheckedPart", risk.unchecked)] : []),
    ].join(", ")
    if (risk.failedRun) return parts ? t("board.approveFailedRunWith", { parts }) : t("board.approveFailedRun")
    return t("board.approveWith", { parts })
  }
}
