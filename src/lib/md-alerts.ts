// GFM alerts (R089): `> [!NOTE]` … `> [!CAUTION]` as callouts, the syntax GitHub renders natively.
// A marked block extension; pure (type imports only), so `node src/lib/md-alerts.check.mts` runs it bare.
import type { TokenizerAndRendererExtension, Token } from "marked"

export const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"] as const
export type AlertKind = (typeof ALERT_KINDS)[number]

// GitHub's own labels: the doc is user content, so they stay English like on GitHub
const LABEL: Record<AlertKind, string> = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" }

// The marker must be alone on the blockquote's first line (GitHub's rule); the body is the following `>` lines.
// ponytail: no lazy continuation lines (a `>`-less line ends the alert); GitHub accepts them, nobody writes them.
const ALERT_RE = /^ {0,3}>[ \t]?\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)((?: {0,3}>.*(?:\n|$))*)/i

interface AlertToken { type: "alert"; raw: string; kind: AlertKind; tokens: Token[] }

export const alertExtension: TokenizerAndRendererExtension = {
  name: "alert",
  level: "block",
  start(src: string) {
    const m = /^ {0,3}>[ \t]?\[!/m.exec(src)
    return m ? m.index : undefined
  },
  tokenizer(src: string) {
    const m = ALERT_RE.exec(src)
    if (!m) return undefined
    const inner = m[2].replace(/^ {0,3}>[ \t]?/gm, "")
    const token: AlertToken = { type: "alert", raw: m[0], kind: m[1].toLowerCase() as AlertKind, tokens: [] }
    this.lexer.blockTokens(inner, token.tokens)
    return token
  },
  renderer(token) {
    const { kind, tokens } = token as unknown as AlertToken
    return `<div class="md-alert" data-alert="${kind}" role="note"><p class="md-alert-title">${LABEL[kind]}</p>\n${this.parser.parse(tokens)}</div>\n`
  },
}
