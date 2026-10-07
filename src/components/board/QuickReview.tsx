"use client"

import { useRef, useState, type CSSProperties, type SyntheticEvent } from "react"
import Link from "next/link"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowUpRight, Bot, ClipboardCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { parseManualTests, type ManualTestItem } from "@/lib/manual-tests"
import { testReviewHref } from "@/lib/test-review"
import { ReviewActions } from "./TaskDetailPanel"
import { StepText, Tick } from "@/components/manual-tests/TestDetail"
import type { Task } from "@/types"

const WIDTH = 384
const GAP = 6

const stop = (e: SyntheticEvent) => e.stopPropagation()

/**
 * T510: a Review button on a task in review (table row, board card, By epic row). It opens a quick review anchored
 * to the button (a centred dialog on phones): the auto-run line, the checklist to tick and Approve / Send back.
 * Radix returns focus to the button on Esc. Renders nothing for other statuses or in the read-only demo.
 */
export function QuickReviewButton({ task, className }: { task: Task; className?: string }) {
  const { demo } = useApp()
  const { t } = useT()
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<CSSProperties | undefined>()
  if (task.status !== "review" || demo) return null

  function onOpenChange(next: boolean) {
    if (next) setAnchor(anchorStyle(ref.current))
    setOpen(next)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          ref={ref}
          type="button"
          data-quick-review={task.id}
          draggable={false}
          onClick={stop /* the row / card would open the task panel */}
          onKeyDown={stop}
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }}
          aria-label={t("board.quickReviewOf", { id: task.id })}
          title={t("board.quickReviewTitle")}
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-accent/50 bg-accent/10 px-1.5 text-[11px] text-txt transition-colors hover:bg-accent/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
            className,
          )}
        >
          <ClipboardCheck className="size-3 text-accent" aria-hidden />
          {t("board.quickReview")}
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {!anchor && <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />}
        <DialogPrimitive.Content
          style={anchor}
          // Portal events still bubble through React to the row / card underneath
          onClick={stop}
          onKeyDown={stop}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl animate-fade-in focus:outline-hidden",
            !anchor && "inset-x-4 top-1/2 max-h-[85svh] -translate-y-1/2",
          )}
        >
          {open && <QuickReview task={task} onDecided={() => setOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Under the button (above it in the lower half of the window), right edges aligned; undefined on phones. */
function anchorStyle(el: HTMLElement | null): CSSProperties | undefined {
  if (!el || !window.matchMedia("(min-width: 640px)").matches) return undefined
  const r = el.getBoundingClientRect()
  const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))
  const below = r.top < window.innerHeight / 2
  return below
    ? { left, width: WIDTH, top: r.bottom + GAP, maxHeight: window.innerHeight - r.bottom - GAP - 8 }
    : { left, width: WIDTH, bottom: window.innerHeight - r.top + GAP, maxHeight: r.top - GAP - 8 }
}

function QuickReview({ task, onDecided }: { task: Task; onDecided: () => void }) {
  const { tickManualTest, refresh } = useApp()
  const { t } = useT()
  const tests = task.raw ? parseManualTests(task.raw) : null
  const items = tests?.items ?? []
  const run = tests?.autoRun ?? null
  // A passed, fully verified run proves the 🤖 items (as on /manual-tests); otherwise a human may tick them
  const proven = run?.result === "passed" && !run.unverified
  const groups = [
    { id: "auto", label: t("tests.automated"), items: items.filter((i) => i.auto) },
    { id: "steps", label: t("tests.colManual"), items: items.filter((i) => !i.auto && i.group === "steps") },
    { id: "regression", label: t("tests.regression"), items: items.filter((i) => !i.auto && i.group === "regression") },
  ].filter((g) => g.items.length)

  const line = (item: ManualTestItem) => {
    const readOnly = item.auto && proven
    const checked = item.checked || readOnly
    return (
      <li key={item.index}>
        <label className={cn("-mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5", !readOnly && "cursor-pointer hover:bg-surface2")}>
          {readOnly
            ? <Bot className="mt-0.5 size-4 shrink-0 text-teal" aria-label={t("tests.provenByRun")} />
            : <Tick checked={checked} onChange={(c) => void tickManualTest(task.id, item.index, c)} />}
          {item.auto && !readOnly && <Bot className="mt-0.5 size-3.5 shrink-0 text-muted" aria-label={t("tests.automated")} />}
          <StepText text={item.text} checked={checked} />
        </label>
      </li>
    )
  }

  const runText = !run ? t("board.autoRunNone")
    : [t("board.autoRunLine", { result: run.result === "failed" ? t("board.runFailed") : t("board.runPassed"), date: run.date }),
      run.unverified ? t("board.unverifiedCount", { n: run.unverified }) : null,
      run.flaky ? t("board.flakyCount", { n: run.flaky }) : null].filter(Boolean).join(" · ")

  return (
    <>
      <header className="flex items-start gap-2 border-b border-border px-4 pt-3 pb-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogPrimitive.Title className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-txt">
            <span className="shrink-0 font-mono text-[11px] font-normal text-muted">{task.id}</span>
            <span data-user-content className="truncate">{task.title}</span>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            data-auto-run
            className={cn("text-xs", run?.result === "failed" ? "text-danger" : run?.flaky || run?.unverified ? "text-amber" : run ? "text-teal" : "text-muted")}
          >
            {runText}
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close aria-label={t("shell.close")} className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-txt focus-visible:outline-2 focus-visible:outline-accent">
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </header>

      <section aria-label={t("tests.checklist")} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {!items.length && <p className="text-sm text-muted">{t("board.quickReviewNoChecklist")}</p>}
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            <h3 className={cn("flex items-baseline gap-1.5 text-xs font-medium", g.id === "regression" ? "text-amber" : "text-txt")}>
              {g.label}
              <span className="font-mono text-[11px] font-normal text-muted tabular-nums">
                {g.items.filter((i) => i.checked || (i.auto && proven)).length}/{g.items.length}
              </span>
            </h3>
            <ol className="flex flex-col">{g.items.map(line)}</ol>
          </div>
        ))}
      </section>

      <ReviewActions
        taskId={task.id}
        onDone={() => { onDecided(); void refresh() }}
        prompt={<></>}
        className="border-t border-b-0 px-4"
      />

      <footer className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs">
        <Link href={testReviewHref(task.id)} className="inline-flex items-center gap-1 text-txt hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          {t("board.openInTestReview")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
        <Link href={testReviewHref(task.id, "evidence")} className="inline-flex items-center gap-1 text-muted hover:text-txt hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          {t("tests.evidence")} <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </footer>
    </>
  )
}
