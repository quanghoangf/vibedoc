"use client"

import { Check, Circle, ListChecks } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"

/** R084: the VibeDoc loop once, ticked from the project's files (summary.firstWeek), live with every summary refresh. */
export function FirstWeek() {
  const { summary, demo } = useApp()
  const { t } = useT()
  const fw = summary?.firstWeek
  if (demo || !fw) return null
  const count = t("firstWeek.progress", { done: fw.done, total: fw.total })
  const countLabel = t("firstWeek.progressLabel", { done: fw.done, total: fw.total })

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
          {fw.steps.map((s) => (
            <SidebarMenuItem key={s.id} className="group-data-[collapsible=icon]:hidden" data-step={s.id} data-done={s.done || undefined}>
              <div className={cn("flex h-7 items-center gap-2 px-2 text-xs", s.done ? "text-muted" : "text-txt")}>
                {s.done
                  ? <Check aria-hidden className="size-3.5 shrink-0 text-teal" />
                  : <Circle aria-hidden className="size-3.5 shrink-0 text-muted" />}
                <span className={cn("min-w-0 flex-1 truncate", s.done && "line-through decoration-border2")}>{t(`firstWeek.${s.id}`)}</span>
                <span className="sr-only">{s.done ? t("firstWeek.stepDone") : t("firstWeek.stepTodo")}</span>
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
