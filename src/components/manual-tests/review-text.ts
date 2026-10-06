"use client"

import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { ReviewRow } from "@/lib/test-review"

/** honesty.ts's reasons a step proves nothing (stepVerdict), in the UI language */
const REASON: Record<string, MessageKey> = {
  "no assertion": "tests.reasonNone",
  "only trivial assertions": "tests.reasonTrivial",
  "passes without the app": "tests.reasonBlank",
}

/**
 * Test review's derived lines in the UI language (R078): what test-review.ts words in English for MCP, here built
 * from the row. `outstanding` = [checks, run]; `selection` = the screen-reader line for the picked row.
 */
export function useReviewText() {
  const { t, tn } = useT()
  const result = (r: ReviewRow["result"]) => (r === "passed" ? t("board.runPassed") : r === "failed" ? t("board.runFailed") : r)
  const checks = (r: ReviewRow, left: (n: number) => string) =>
    !(r.manual.total + r.auto.total) ? t("tests.selNoChecklist") : r.left ? left(r.left) : t("tests.selAllTicked")
  return {
    outstanding: (r: ReviewRow, failedStep: number | null = null): [string, string] => [
      checks(r, (n) => tn("tests.checksUnticked", n)),
      r.result === "none" ? t("tests.selNoRun")
        : r.result === "passed" ? (r.unverified ? t("tests.runPassedUnverified", { n: r.unverified }) : t("tests.runPassedPlain"))
        : failedStep ? t("tests.runFailedAt", { n: failedStep }) : t("tests.runFailedPlain"),
    ],
    selection: (r: ReviewRow) => [
      r.id,
      r.result === "none" ? t("tests.selNoRun") : `${t("tests.selLastRun", { result: result(r.result) })}${r.steps ? ` ${r.steps.passed}/${r.steps.total}` : ""}`,
      checks(r, (n) => tn("tests.selChecksLeft", n)),
    ].join(" · "),
    reason: (reason: string) => (REASON[reason] ? t(REASON[reason]) : reason),
  }
}
