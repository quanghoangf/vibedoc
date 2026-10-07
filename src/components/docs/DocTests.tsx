"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { testReviewHref } from "@/lib/test-review"
import { DOC_TESTS_KEY, shouldHandleShortcut } from "@/lib/shortcuts"
import type { Task } from "@/types"

// T507: a task doc's manual tests in /docs. One chip (the board card's 🧪 badge: FlaskConical + mono done/total,
// same tones) in the property row, the header bar and at the `## Manual tests` heading, all opening Test review.

type Tests = NonNullable<Task["manualTests"]>

const TASK_FILE = /^plans\/tasks\/(T\d+)[^/]*\.md$/i

/** The board task a task file belongs to (AppContext `board`, by id); undefined for any other doc */
export function useDocTask(path: string): Task | undefined {
  const { board } = useApp()
  const id = TASK_FILE.exec(path)?.[1].toUpperCase()
  return id ? Object.values(board ?? {}).flat().find((x) => x.id === id) : undefined
}

/** The board card's manual-test badge tone: failed red, flaky amber (R065), all ticked teal, else neutral */
export function testChipTone(tests: Tests): string {
  return tests.autoRun?.result === "failed" ? "border-danger/40 text-danger"
    : tests.autoRun?.flaky ? "border-amber/40 bg-amber/5 text-amber"
    : tests.untested === 0 ? "border-teal/30 bg-teal/5 text-teal" : "border-border text-muted"
}

const chipBase = "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-4 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-accent"

/** 🧪 done/total → this task in Test review; `label` adds words after the count (the heading action) */
export function TestChip({ task, label, className }: { task: Task & { manualTests: Tests }; label?: string; className?: string }) {
  const { t } = useT()
  const tests = task.manualTests
  return (
    <Link href={testReviewHref(task.id)} data-doc-tests
      aria-label={`${t("board.testsTicked", { done: tests.done, total: tests.total })} · ${t("board.openInTestReview")}`}
      title={t("docs.openTestReviewKey", { key: DOC_TESTS_KEY.label })}
      className={cn(chipBase, testChipTone(tests), className)}>
      <FlaskConical className="size-3" aria-hidden />
      {tests.done}/{tests.total}
      {label && <span className="ml-0.5 font-sans text-[11px]">{label}</span>}
    </Link>
  )
}

/** The last automated result in words, coloured only when it means something (Highlighter Rule) */
function AutoResult({ tests }: { tests: Tests }) {
  const { t } = useT()
  const run = tests.autoRun
  if (!run) return tests.auto ? <span className="text-xs text-muted">{t("docs.testsNotRun")}</span> : null
  const [text, tone] = run.result === "failed" ? [t("board.runFailed"), "text-danger"]
    : run.unverified ? [t("tests.unverifiedCount", { n: run.unverified }), "text-amber"]
    : run.flaky ? [t("board.flakyCount", { n: run.flaky }), "text-amber"]
    : [t("board.runPassed"), "text-teal"]
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 text-xs">
      <span className={tone}>{text}</span>
      <span className="font-mono text-[11px] text-muted">{run.date}</span>
    </span>
  )
}

/** The "Manual tests" property row's value: chip · auto result · Evidence ↗, or the empty text */
export function TestsRowValue({ task }: { task: Task }) {
  const { t } = useT()
  const tests = task.manualTests
  if (!tests) return <span data-doc-tests-empty className="text-[13px] text-muted">{t("docs.testsNone")}</span>
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
      <TestChip task={{ ...task, manualTests: tests }} />
      <AutoResult tests={tests} />
      <Link href={testReviewHref(task.id, "evidence")} data-doc-evidence
        className="inline-flex items-center gap-0.5 rounded-sm text-xs text-muted transition-colors hover:text-txt focus-visible:outline-2 focus-visible:outline-accent">
        {t("tests.evidence")} <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </span>
  )
}

/** ⇧T on a task doc with manual tests: open it in Test review (listed in the /docs Help panel) */
export function useDocTestsKey(task: Task | undefined) {
  const router = useRouter()
  const href = task?.manualTests ? testReviewHref(task.id) : null
  useEffect(() => {
    if (!href) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== DOC_TESTS_KEY.key || !shouldHandleShortcut(e) || document.querySelector("[role=menu],[role=dialog]")) return
      e.preventDefault()
      router.push(href!)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [href, router])
}
