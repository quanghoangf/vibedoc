// Visual blocks (R096): a plain list right under `<!-- vibedoc:steps|cards|compare|timeline -->` renders as stacked
// numbered steps on a connecting rail (steps), a grid of cards (cards), 2–3 columns side by side (compare; more items fall back to
// cards) or a vertical rail of dated items (timeline). The marker is an HTML comment, so GitHub, /md/
// and vibedoc_read_doc show the normal list. Pure: `node src/lib/md-visual-blocks.check.mts`.
import { Lexer } from "marked"
import type { Token, Tokens, TokenizerAndRendererExtension } from "marked"

export const VISUAL_KINDS = ["steps", "cards", "compare", "timeline"] as const
export type VisualKind = (typeof VISUAL_KINDS)[number]
// compare reads side by side only up to this many columns; more items render as cards
export const MAX_COMPARE = 3

const MARKER_RE = /^<!--\s*vibedoc:([\w-]+)\s*-->\s*$/

/** The kind named by a `<!-- vibedoc:<kind> -->` html token, if it is one of VISUAL_KINDS. */
function markerKind(t: Token | undefined): VisualKind | null {
  if (t?.type !== "html") return null
  const kind = MARKER_RE.exec(t.raw.trim())?.[1] as VisualKind | undefined
  return kind && VISUAL_KINDS.includes(kind) ? kind : null
}

interface VisualToken { type: "visual"; raw: string; kind: VisualKind; list: Tokens.List }

/**
 * marked `processAllTokens` hook: a marker followed (blank lines allowed) by a list becomes one `visual` token.
 * A marker with no list, or an unknown kind, is left as is (the comment renders as nothing).
 * ponytail: top-level only, like groupFences; a marker inside a list item or an alert is ignored.
 */
export function groupVisualBlocks(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const kind = markerKind(tokens[i])
    let j = i + 1
    while (tokens[j]?.type === "space") j++
    const list = tokens[j]
    if (!kind || list?.type !== "list") { out.push(tokens[i]); continue }
    const block: VisualToken = { type: "visual", raw: tokens.slice(i, j + 1).map((t) => t.raw).join(""), kind, list: list as Tokens.List }
    out.push(block as unknown as Token)
    i = j
  }
  return out
}

export interface VisualItem { icon?: string; title: string; body: string; detail: string }

const ICON_RE = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*)\s*/u
// `**Title** — body`, `**Title**: body`, `**Title** - body` or `**Title** body`
const TITLE_RE = /^\*\*(.+?)\*\*\s*(?:[—–:-]\s*)?(.*)$/

/**
 * One list item's markdown (marked's `item.text`): the leading **bold** is the title (its emoji, if any, the icon),
 * the rest of the first line the body, every following line or paragraph the detail. No bold → no title.
 */
export function splitItem(text: string): VisualItem {
  const nl = text.indexOf("\n")
  const first = (nl < 0 ? text : text.slice(0, nl)).trim()
  const detail = nl < 0 ? "" : text.slice(nl + 1).trim()
  const m = TITLE_RE.exec(first)
  if (!m) return { title: "", body: first, detail }
  const icon = ICON_RE.exec(m[1])
  const title = icon ? m[1].slice(icon[0].length).trim() : m[1].trim()
  return { ...(icon ? { icon: icon[1] } : {}), title, body: m[2].trim(), detail }
}

const NOW_RE = /\bnow\b/i

/** compare with more than MAX_COMPARE items doesn't fit side by side: it renders as cards. */
export function renderedKind(kind: VisualKind, items: number): VisualKind {
  return kind === "compare" && items > MAX_COMPARE ? "cards" : kind
}

export const visualBlocksExtension: TokenizerAndRendererExtension = {
  name: "visual",
  level: "block",
  renderer(token) {
    const { list } = token as unknown as VisualToken
    const kind = renderedKind((token as unknown as VisualToken).kind, list.items.length)
    const opts = this.parser.options
    // item text goes back through the same parser, so links, code and [[wikilinks]] still work
    const inline = (s: string) => this.parser.parseInline(Lexer.lexInline(s, opts))
    const first = list.ordered && typeof list.start === "number" ? list.start : 1
    const items = list.items.map((item, i) => {
      const { icon, title, body, detail } = splitItem(item.text)
      const card = [
        icon ? `<span class="md-visual-icon">${icon}</span>` : "",
        title ? `<strong class="md-visual-title">${inline(title)}</strong>` : "",
        body ? `<div class="md-visual-body">${inline(body)}</div>` : "",
        detail ? `<div class="md-visual-detail">${this.parser.parse(Lexer.lex(detail, opts))}</div>` : "",
      ].join("")
      // the number is drawn (list-style is off); the <ol> already gives it to screen readers
      const num = kind === "steps" ? `<span class="md-visual-num" aria-hidden="true">${first + i}</span>` : ""
      if (kind === "timeline") {
        // the one accent goes to the item whose label says "now"; every other dot stays neutral
        const now = NOW_RE.test(title) ? " data-now" : ""
        return `<li${now}><span class="md-visual-dot" aria-hidden="true"></span><div class="md-visual-card">${card}</div></li>`
      }
      return `<li>${num}<div class="md-visual-card">${card}</div></li>`
    })
    const tag = list.ordered ? "ol" : "ul"
    const start = list.ordered && list.start !== 1 && list.start !== "" ? ` start="${list.start}"` : ""
    // role=list: list-style: none drops list semantics in Safari
    // the markdown it came from, for Copy (T517): the plain-text half of the clipboard
    const source = (token as unknown as VisualToken).raw.replace(/\s+$/, "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `<div class="md-visual" data-visual="${kind}" data-source="${source}"><${tag} role="list"${start}>${items.join("")}</${tag}></div>\n`
  },
}
