// GFM alerts (R089): `> [!NOTE]` … `> [!CAUTION]` as callouts, the syntax GitHub renders natively.
// A marked block extension; pure (type imports only), so `node src/lib/md-alerts.check.mts` runs it bare.
import type { TokenizerAndRendererExtension, Token } from "marked"

export const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"] as const
export type AlertKind = (typeof ALERT_KINDS)[number]

// GitHub's own labels: the doc is user content, so they stay English like on GitHub
const LABEL: Record<AlertKind, string> = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" }

// lucide info · lightbulb · message-square-warning · triangle-alert · octagon-alert, in the alert's hue via CSS
const ICON_PATHS: Record<AlertKind, string> = {
  note: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  important: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  caution: '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
}
const icon = (kind: AlertKind) =>
  `<svg class="md-alert-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind]}</svg>`

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
    return `<div class="md-alert" data-alert="${kind}" role="note"><p class="md-alert-title">${icon(kind)}${LABEL[kind]}</p>\n${this.parser.parse(tokens)}</div>\n`
  },
}
