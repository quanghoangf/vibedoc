"use client"

import { useState } from "react"
import { Puzzle } from "lucide-react"
import { useT } from "@/context/LanguageContext"
import { ToolkitBody } from "@/components/toolkit/ToolkitBody"
import { ToolkitConfirmDialog } from "@/components/toolkit/ToolkitConfirmDialog"
import { useToolkit } from "@/components/toolkit/use-toolkit"
import type { ToolkitResult } from "@/components/toolkit/ToolkitPicker"

/** A `vibedoc_propose_toolkit` call (R098 S5): `results` is set once the user installed from the card. */
export interface ToolkitProposal {
  id: string
  preselect?: string[]
  note?: string
  results?: { id: string; ok: boolean }[]
}

/** The agent's toolkit proposal: the welcome's picker and confirm dialog; the results go back as the next message. */
export function ToolkitCard({ set, disabled, onDone }: { set: ToolkitProposal; disabled: boolean; onDone: (results: ToolkitResult[]) => void }) {
  const { t } = useT()
  // Installed from this card just now: keep the picker, it shows each item's ✓ or error; a reload shows the summary
  const [here, setHere] = useState(false)
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3" data-toolkit-card>
      <div className="flex items-center gap-2 text-sm font-medium text-txt">
        <Puzzle aria-hidden className="size-4 text-accent" />{t("chat.toolkitTitle")}
      </div>
      {set.note && <p data-user-content className="text-xs text-muted">{set.note}</p>}
      {set.results && !here
        ? <Summary results={set.results} />
        : <Pending set={set} disabled={disabled || !!set.results} onDone={(r) => { setHere(true); onDone(r) }} />}
    </div>
  )
}

function Pending({ set, disabled, onDone }: { set: ToolkitProposal; disabled: boolean; onDone: (results: ToolkitResult[]) => void }) {
  const tk = useToolkit(set.preselect)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <ToolkitBody tk={tk} onInstall={() => { if (!disabled) setConfirm(true) }} />
      {confirm && (
        <ToolkitConfirmDialog
          items={tk.picked}
          onConfirm={async () => { setConfirm(false); onDone(await tk.install()) }}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  )
}

function Summary({ results }: { results: { id: string; ok: boolean }[] }) {
  const { t } = useT()
  const ok = results.filter((r) => r.ok).map((r) => r.id)
  const failed = results.filter((r) => !r.ok).map((r) => r.id)
  return (
    <div className="space-y-1 text-xs" role="status">
      {ok.length > 0 && <p className="text-teal">{t("chat.toolkitInstalledList", { list: ok.join(", ") })}</p>}
      {failed.length > 0 && <p className="text-amber-400">{t("chat.toolkitFailedList", { list: failed.join(", ") })}</p>}
    </div>
  )
}
