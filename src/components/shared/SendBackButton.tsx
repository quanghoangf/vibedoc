"use client"

import { CornerUpLeft } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

/** The compact size every review decision button shares (Inbox rows, the task panel, Test review, Quick review). */
export const DECISION_BUTTON = "h-8 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5"

/**
 * THE Send back button: always outline, never the filled primary, "Send back…" unless a surface names what it sends
 * ("Send back 2 findings"). Approve is the one filled primary only when nothing is unproven (`approveRisk`); when
 * something is, neither button is filled and the verdict line above carries the message.
 */
export function SendBackButton({ className, children, ...props }: ButtonProps) {
  const { t } = useT()
  return (
    <Button type="button" variant="outline" size="sm" className={cn(DECISION_BUTTON, className)} {...props}>
      <CornerUpLeft aria-hidden /> {children ?? t("board.sendBackEllipsis")}
    </Button>
  )
}
