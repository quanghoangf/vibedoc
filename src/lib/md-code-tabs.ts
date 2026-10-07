// Code tabs (R089): two or more fences in a row, each titled (```bash title="pnpm"), render as one tabbed block.
// On GitHub they stay plain consecutive code blocks. Pure (type imports only): `node src/lib/md-code-tabs.check.mts`.
// Behaviour (click, arrow keys) is wired on the rendered HTML by components/docs/code-tabs.ts.
import type { Token, Tokens, TokenizerAndRendererExtension } from "marked"

const TITLE_RE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/

/** The `title="…"` of a fence's info string, or null. */
export function fenceTitle(lang: string | undefined): string | null {
  const m = TITLE_RE.exec(lang ?? "")
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

interface CodeGroupToken { type: "codegroup"; raw: string; fences: Tokens.Code[] }

const titled = (t: Token | undefined): t is Tokens.Code => t?.type === "code" && fenceTitle((t as Tokens.Code).lang) !== null

/**
 * marked `processAllTokens` hook: runs of ≥ 2 titled fences (blank lines between allowed) become one `codegroup` token.
 * ponytail: top-level fences only; a group inside a list or an alert stays separate blocks. Walk `tokens` children if needed.
 */
export function groupFences(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const fences: Tokens.Code[] = []
    let j = i
    while (titled(tokens[j])) {
      fences.push(tokens[j] as Tokens.Code)
      let k = j + 1
      while (tokens[k]?.type === "space") k++
      j = k
      if (!titled(tokens[j])) break
    }
    if (fences.length < 2) { out.push(tokens[i]); continue }
    // keep the trailing space token (if any) so the blocks after the group are untouched
    const last = tokens.indexOf(fences[fences.length - 1])
    const group: CodeGroupToken = { type: "codegroup", raw: tokens.slice(i, last + 1).map((t) => t.raw).join(""), fences }
    out.push(group as unknown as Token)
    i = last
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export const codeTabsExtension: TokenizerAndRendererExtension = {
  name: "codegroup",
  level: "block",
  renderer(token) {
    const { fences } = token as unknown as CodeGroupToken
    const tabs = fences.map((f, i) =>
      `<button type="button" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(fenceTitle(f.lang) ?? "")}</button>`)
    // each fence still goes through the normal code renderer (mermaid, language class), without its title
    const panels = fences.map((f, i) =>
      `<div role="tabpanel" tabindex="0"${i === 0 ? "" : " hidden"}>${this.parser.parse([{ ...f, lang: (f.lang ?? "").replace(TITLE_RE, "").trim() }])}</div>`)
    return `<div class="md-code-group" data-code-group><div role="tablist">${tabs.join("")}</div>${panels.join("")}</div>\n`
  },
}
