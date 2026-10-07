"use client"

import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  Link2, Code, Code2, Quote,
  Minus, List, ListOrdered,
  MessageSquareWarning, SquareChevronDown,
} from "lucide-react"
import type { EditorView } from "@codemirror/view"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/context/LanguageContext"

interface EditorToolbarProps {
  editorView: EditorView | null
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: before + selected + after },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  })
  view.focus()
}

function prefixLine(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
    selection: { anchor: from + prefix.length },
  })
  view.focus()
}

function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

interface ToolBtnProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function ToolBtn({ icon, label, onClick }: ToolBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClick} aria-label={label}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function EditorToolbar({ editorView }: EditorToolbarProps) {
  const v = editorView
  const { t } = useT()

  function bold() { if (v) wrapSelection(v, "**", "**") }
  function italic() { if (v) wrapSelection(v, "*", "*") }
  function strike() { if (v) wrapSelection(v, "~~", "~~") }
  function h1() { if (v) prefixLine(v, "# ") }
  function h2() { if (v) prefixLine(v, "## ") }
  function h3() { if (v) prefixLine(v, "### ") }
  function link() {
    if (!v) return
    const { from, to } = v.state.selection.main
    const selected = v.state.sliceDoc(from, to)
    const text = selected || "link text"
    v.dispatch({
      changes: { from, to, insert: `[${text}](url)` },
      selection: { anchor: from + text.length + 3, head: from + text.length + 3 + 3 },
    })
    v.focus()
  }
  function inlineCode() { if (v) wrapSelection(v, "`", "`") }
  function codeBlock() { if (v) wrapSelection(v, "```\n", "\n```") }
  function blockquote() { if (v) prefixLine(v, "> ") }
  // GFM alert (R089) over the selected lines; "NOTE" is left selected so typing WARNING / TIP / … changes the kind
  function callout() {
    if (!v) return
    const { from, to } = v.state.selection.main
    const start = v.state.doc.lineAt(from).from
    const end = v.state.doc.lineAt(to).to
    const body = v.state.sliceDoc(start, end)
    const insert = "> [!NOTE]\n" + (body ? body.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n") : "> ")
    v.dispatch({ changes: { from: start, to: end, insert }, selection: { anchor: start + 4, head: start + 8 } })
    v.focus()
  }
  // <details> around the selection (R089); blank lines keep the markdown inside rendering, "Summary" is left selected
  function collapsible() {
    if (!v) return
    const { from, to } = v.state.selection.main
    const lead = from === v.state.doc.lineAt(from).from ? "" : "\n\n"
    const open = `${lead}<details>\n<summary>`
    const insert = `${open}Summary</summary>\n\n${v.state.sliceDoc(from, to) || "…"}\n\n</details>\n`
    v.dispatch({ changes: { from, to, insert }, selection: { anchor: from + open.length, head: from + open.length + 7 } })
    v.focus()
  }
  function hr() { if (v) insertAtCursor(v, "\n---\n") }
  function unorderedList() { if (v) prefixLine(v, "- ") }
  function orderedList() { if (v) prefixLine(v, "1. ") }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1 border-b border-border bg-surface shrink-0">
        <ToolBtn icon={<Bold className="h-3.5 w-3.5" />} label={t("docs.bold")} onClick={bold} />
        <ToolBtn icon={<Italic className="h-3.5 w-3.5" />} label={t("docs.italic")} onClick={italic} />
        <ToolBtn icon={<Strikethrough className="h-3.5 w-3.5" />} label={t("docs.strikethrough")} onClick={strike} />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolBtn icon={<Heading1 className="h-3.5 w-3.5" />} label={t("docs.heading1")} onClick={h1} />
        <ToolBtn icon={<Heading2 className="h-3.5 w-3.5" />} label={t("docs.heading2")} onClick={h2} />
        <ToolBtn icon={<Heading3 className="h-3.5 w-3.5" />} label={t("docs.heading3")} onClick={h3} />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolBtn icon={<Link2 className="h-3.5 w-3.5" />} label={t("docs.link")} onClick={link} />
        <ToolBtn icon={<Code className="h-3.5 w-3.5" />} label={t("docs.inlineCode")} onClick={inlineCode} />
        <ToolBtn icon={<Code2 className="h-3.5 w-3.5" />} label={t("docs.codeBlock")} onClick={codeBlock} />
        <ToolBtn icon={<Quote className="h-3.5 w-3.5" />} label={t("docs.blockquote")} onClick={blockquote} />
        <ToolBtn icon={<MessageSquareWarning className="h-3.5 w-3.5" />} label={t("docs.callout")} onClick={callout} />
        <ToolBtn icon={<SquareChevronDown className="h-3.5 w-3.5" />} label={t("docs.collapsible")} onClick={collapsible} />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} label={t("docs.horizontalRule")} onClick={hr} />
        <ToolBtn icon={<List className="h-3.5 w-3.5" />} label={t("docs.unorderedList")} onClick={unorderedList} />
        <ToolBtn icon={<ListOrdered className="h-3.5 w-3.5" />} label={t("docs.orderedList")} onClick={orderedList} />
      </div>
    </TooltipProvider>
  )
}
