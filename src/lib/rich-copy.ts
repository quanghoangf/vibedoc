// Copy that keeps the look (T517): a visual block as HTML that Google Docs, Notion, Slack and mail keep when pasted.
// Paste targets drop classes and stylesheets, so every colour is an inline literal (the light palette: pasted docs are
// almost always light) and the layout is a table, which Google Docs keeps where it drops flex and grid.
// Pure: `node src/lib/rich-copy.check.mts`.

/** One card, as the rendered block's HTML (already sanitized markdown): title / body / detail, icon text. */
export interface RichItem { icon?: string; title: string; body: string; detail: string; now?: boolean }
export interface Palette { ink: string; muted: string; border: string; surface: string; accent: string }

// DESIGN.md light tokens (globals.css :root); the accent is the viewer's, passed in
export const PASTE_PALETTE: Omit<Palette, "accent"> = { ink: "#1a1a2e", muted: "#6b6b80", border: "#e0e0ee", surface: "#f8f8fc" }

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const MONO = "font-family:ui-monospace,Menlo,Consolas,monospace"
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function card(it: RichItem, p: Palette, titleStyle = `font-weight:600;color:${p.ink}`): string {
  return [
    it.icon || it.title ? `<div style="${titleStyle};margin:0 0 2px">${it.icon ? `${esc(it.icon)} ` : ""}${it.title}</div>` : "",
    it.body ? `<div style="color:${p.ink};margin:0">${it.body}</div>` : "",
    it.detail ? `<div style="color:${p.muted};font-size:13px;margin:4px 0 0">${it.detail}</div>` : "",
  ].join("")
}

const box = (p: Palette, extra = "") => `border:1px solid ${p.border};background:${p.surface};padding:10px 14px;vertical-align:top;${extra}`

/** The block as inline-styled HTML; `kind` is the rendered kind (a >3-item compare is already "cards"). */
export function visualBlockToHtml(kind: string, items: RichItem[], p: Palette): string {
  const table = (rows: string) => `<table style="${FONT};font-size:14px;line-height:1.5;border-collapse:collapse;width:100%">${rows}</table>`
  if (kind === "steps") {
    // a round number badge per step, like the page (paste targets that drop the radius still show a boxed number)
    const num = `display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;border:1px solid ${p.border};background:${p.surface};color:${p.ink};text-align:center;font-weight:600;font-size:13px`
    return table(items.map((it, i) => `<tr><td style="width:1%;vertical-align:top;padding:8px 12px 8px 0"><span style="${num}">${i + 1}</span></td>` +
      `<td style="vertical-align:top;padding:10px 0 8px">${card(it, p)}</td></tr>`).join(""))
  }
  if (kind === "compare") {
    return table(`<tr>${items.map((it) => `<td style="${box(p, `width:${Math.floor(100 / items.length)}%`)}">${card(it, p)}</td>`).join("")}</tr>`)
  }
  if (kind === "timeline") {
    return table(items.map((it) => {
      const label = `${MONO};font-size:12px;color:${it.now ? p.accent : p.muted};white-space:nowrap;width:1%;padding:6px 14px 6px 0;vertical-align:top;border-right:1px solid ${p.border}`
      const rest = card({ ...it, title: "", icon: undefined }, p)
      return `<tr><td style="${label}">${it.now ? "● " : "○ "}${it.title}</td><td style="padding:6px 0 6px 14px;vertical-align:top">${rest}</td></tr>`
    }).join(""))
  }
  // cards: two per row
  const rows: string[] = []
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2)
    rows.push(`<tr>${pair.map((it) => `<td style="${box(p, "width:50%")}">${card(it, p)}</td>`).join("")}${pair.length === 1 ? "<td></td>" : ""}</tr>`)
  }
  return table(rows.join(""))
}
