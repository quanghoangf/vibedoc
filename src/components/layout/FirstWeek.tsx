"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, Circle, Copy, ListChecks } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { stepAction, type FirstWeekStepId } from "@/lib/first-week"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { useOrigin } from "@/hooks/use-origin"

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-accent"

/** R084: the VibeDoc loop once, ticked from the project's files (summary.firstWeek), live with every summary refresh. */
export function FirstWeek() {
  const { summary, demo } = useApp()
  const { t } = useT()
  const origin = useOrigin()
  // The open step: the one the user clicked ("none" = they closed it), else the next unticked one (S2).
  // A pick lasts until the next step changes, so a new tick always opens the step after it.
  const [pick, setPick] = useState<{ id: FirstWeekStepId | "none"; next: FirstWeekStepId | null } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const fw = summary?.firstWeek
  if (demo || !fw) return null
  const open = pick && pick.next === fw.next ? pick.id : fw.next
  const count = t("firstWeek.progress", { done: fw.done, total: fw.total })
  const countLabel = t("firstWeek.progressLabel", { done: fw.done, total: fw.total })

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch (e) {
      console.warn("[vibedoc] could not copy:", e)
    }
  }

  return (
    <SidebarGroup role="group" aria-label={t("firstWeek.title")} data-testid="first-week">
      <SidebarGroupLabel>
        {t("firstWeek.title")}
        <span aria-hidden className="ml-auto font-mono tabular-nums">{count}</span>
        <span className="sr-only">{countLabel}</span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Icon-collapsed sidebar: one icon, the count in its tooltip */}
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarMenuButton tooltip={`${t("firstWeek.title")} ${count}`} aria-label={`${t("firstWeek.title")}: ${countLabel}`}>
              <ListChecks />
            </SidebarMenuButton>
          </SidebarMenuItem>
          {fw.steps.map((s) => {
            const expanded = !s.done && open === s.id
            const action = stepAction(s.id, { origin, epicToBreakDown: fw.epicToBreakDown, epicToWork: fw.epicToWork })
            return (
              <SidebarMenuItem key={s.id} className="group-data-[collapsible=icon]:hidden" data-step={s.id} data-done={s.done || undefined}>
                <button
                  type="button"
                  disabled={s.done}
                  aria-expanded={s.done ? undefined : expanded}
                  onClick={() => setPick({ id: expanded ? "none" : s.id, next: fw.next })}
                  className={cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs", focusRing, s.done ? "text-muted" : "text-txt hover:bg-surface2")}
                >
                  {s.done
                    ? <Check aria-hidden className="size-3.5 shrink-0 text-teal" />
                    : <Circle aria-hidden className="size-3.5 shrink-0 text-muted" />}
                  <span className={cn("min-w-0 flex-1 truncate", s.done && "line-through decoration-border2")}>{t(`firstWeek.${s.id}`)}</span>
                  <span className="sr-only">{s.done ? t("firstWeek.stepDone") : t("firstWeek.stepTodo")}</span>
                  {!s.done && <ChevronRight aria-hidden className={cn("size-3 shrink-0 text-muted transition-transform", expanded && "rotate-90")} />}
                </button>
                {expanded && (
                  <div className="mx-2 mb-1 mt-0.5 space-y-1.5 rounded-md border border-border bg-bg p-2 text-xs" data-testid="first-week-action">
                    <p className="text-muted">{t(`firstWeek.${s.id}Why`)}</p>
                    {action.command && (
                      <button
                        type="button"
                        onClick={() => void copy(action.command!)}
                        aria-label={t("firstWeek.copyCommand", { command: action.command })}
                        className={cn("flex w-full items-start gap-1 rounded-md border border-border bg-surface px-2 py-1 text-left hover:border-border2", focusRing)}
                      >
                        <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-accent">{action.command}</code>
                        <span aria-hidden className="grid size-4 shrink-0 place-items-center text-muted" title={copied === action.command ? t("firstWeek.copied") : t("firstWeek.copy")}>
                          {copied === action.command ? <Check className="size-3 text-teal" /> : <Copy className="size-3" />}
                        </span>
                      </button>
                    )}
                    {action.href && (
                      <Link href={action.href} className={cn("inline-block rounded-sm text-accent hover:underline", focusRing)}>
                        {t("firstWeek.open")} <span className="font-mono">{action.href}</span>
                      </Link>
                    )}
                  </div>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
