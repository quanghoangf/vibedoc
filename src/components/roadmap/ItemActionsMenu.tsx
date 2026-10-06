"use client"

import { Copy, FileText, FolderInput, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { itemKeyLabel } from "@/components/shared/item-commands"
import { StatusDot, useRoadmapStatusLabel } from "./RoadmapNodes"
import { useT } from "@/context/LanguageContext"
import type { RoadmapItem, RoadmapStatus } from "@/types"

const STATUSES: RoadmapStatus[] = ["planned", "in-progress", "paused", "done"]

/** What the roadmap page does for each menu entry. The menu itself holds no state. */
export interface ItemActions {
  edit: (id: string) => void
  setStatus: (id: string, status: RoadmapStatus) => void
  move: (id: string, horizonId: string) => void
  addEpic: (horizonId: string) => void
  duplicate: (id: string) => void
  openFile: (file: string) => void
  chat: (id: string) => void
  remove: (id: string) => void
}

function ItemMenuItems({ item, items, actions }: { item: RoadmapItem; items: RoadmapItem[]; actions: ItemActions }) {
  const isHorizon = item.parent === null
  const horizons = items.filter((i) => i.parent === null && i.id !== item.parent).sort((a, b) => a.order - b.order)
  const children = items.filter((i) => i.parent === item.id).length
  const { t, tn } = useT()
  const statusLabel = useRoadmapStatusLabel()

  return (
    <>
      <DropdownMenuItem onSelect={() => actions.edit(item.id)}><Pencil /> {t("board.edit")}<DropdownMenuShortcut>{itemKeyLabel("edit")}</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger><StatusDot status={item.status} /> {t("board.status")}<DropdownMenuShortcut>{itemKeyLabel("status")}</DropdownMenuShortcut></DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {STATUSES.map((s) => (
            <DropdownMenuItem key={s} disabled={s === item.status} onSelect={() => actions.setStatus(item.id, s)}>
              <StatusDot status={s} /> {statusLabel(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {!isHorizon && horizons.length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><FolderInput /> {t("roadmap.moveToHorizon")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            {horizons.map((h) => (
              <DropdownMenuItem key={h.id} onSelect={() => actions.move(item.id, h.id)}>
                <span className="font-mono text-[11px] text-muted">{h.id}</span> {h.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {isHorizon && <DropdownMenuItem onSelect={() => actions.addEpic(item.id)}><Plus /> {t("roadmap.addEpic")}</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => actions.duplicate(item.id)}><Copy /> {t("roadmap.duplicate")}<DropdownMenuShortcut>{itemKeyLabel("duplicate")}</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuSeparator />
      {!isHorizon && <DropdownMenuItem onSelect={() => actions.chat(item.id)}><MessageSquare /> {t("roadmap.chatAboutIt")}<DropdownMenuShortcut>{itemKeyLabel("chat")}</DropdownMenuShortcut></DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => actions.openFile(item.file)}><FileText /> {t("roadmap.openFile")}</DropdownMenuItem>
      <DropdownMenuSeparator />
      {children > 0 ? (
        <DropdownMenuItem disabled className="flex-col items-start gap-0">
          <span className="flex items-center gap-2"><Trash2 /> {t("board.delete")}</span>
          <span className="pl-6 text-[11px]">{tn("roadmap.moveChildrenFirst", children)}</span>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={() => actions.remove(item.id)} className="text-danger focus:text-danger">
          <Trash2 /> {t("board.delete")}<DropdownMenuShortcut>{itemKeyLabel("remove")}</DropdownMenuShortcut>
        </DropdownMenuItem>
      )}
    </>
  )
}

/** ⋯ button that opens the item's actions. */
export function ItemActionsMenu({ item, items, actions, className, open, onOpenChange }: {
  item: RoadmapItem
  items: RoadmapItem[]
  actions: ItemActions
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useT()
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("board.actionsFor", { id: item.id })}
          className={cn("grid size-7 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt", className)}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <ItemMenuItems item={item} items={items} actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type ContextMenuState = { id: string; x: number; y: number } | null

/** The same actions, opened at the pointer (right-click on a map node or timeline bar). */
export function ItemContextMenu({ at, items, actions, onClose }: {
  at: ContextMenuState
  items: RoadmapItem[]
  actions: ItemActions
  onClose: () => void
}) {
  const item = at && items.find((i) => i.id === at.id)
  if (!at || !item) return null
  return (
    // keyed by position so a second right-click re-anchors the menu
    <DropdownMenu key={`${at.id}:${at.x}:${at.y}`} open onOpenChange={(open) => { if (!open) onClose() }}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: at.x, top: at.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <ItemMenuItems item={item} items={items} actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
