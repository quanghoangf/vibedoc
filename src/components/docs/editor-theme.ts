import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

// The markdown editor in the notebook's own tokens, so theme, accent and light/dark all follow Settings.
const chrome = EditorView.theme({
  "&": { backgroundColor: "var(--color-bg)", color: "var(--color-txt)", height: "100%" },
  ".cm-content": { caretColor: "var(--color-accent)", padding: "12px 0" },
  ".cm-line": { padding: "0 16px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-accent)", borderLeftWidth: "2px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
    { backgroundColor: "rgb(var(--rgb-accent) / 0.22)" },
  ".cm-activeLine": { backgroundColor: "rgb(var(--rgb-surface2) / 0.5)" },
  ".cm-gutters": { backgroundColor: "var(--color-bg)", color: "rgb(var(--rgb-muted) / 0.6)", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-txt)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px", fontSize: "11px" },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--color-muted)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)" },
  ".cm-matchingBracket": { backgroundColor: "rgb(var(--rgb-accent) / 0.15)", outline: "none" },
  ".cm-tooltip": { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-txt)" },
  ".cm-panels": { backgroundColor: "var(--color-surface)", color: "var(--color-txt)" },
  ".cm-searchMatch": { backgroundColor: "rgb(var(--rgb-amber) / 0.25)" },
  ".cm-placeholder": { color: "var(--color-muted)" },
})

// Mirrors the preview: h2 tint, accent links, teal code, muted quotes; markdown marks (#, **, `) recede.
const syntax = HighlightStyle.define([
  { tag: t.heading1, fontWeight: "600", color: "var(--color-txt)" },
  { tag: [t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: "600", color: "color-mix(in srgb, var(--color-accent) 75%, var(--color-txt))" },
  { tag: t.strong, fontWeight: "600", color: "var(--color-txt)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--color-accent)" },
  // Mixed toward text so it holds contrast on paper as well as on ink
  { tag: t.monospace, color: "color-mix(in srgb, var(--color-teal) 65%, var(--color-txt))" },
  { tag: t.quote, color: "var(--color-muted)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: "var(--color-muted)" },
  { tag: [t.keyword, t.string, t.number, t.comment], color: "color-mix(in srgb, var(--color-txt) 85%, var(--color-accent))" },
])

export const editorTheme = [chrome, syntaxHighlighting(syntax)]
