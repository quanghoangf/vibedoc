// Mermaid in VibeDoc's own style (R096): `theme: "base"` + these themeVariables, read from the design tokens at render
// time so light and dark both follow. Hairlines, surfaces and ink only; the one accent is a CSS rule on `class X accent`
// (globals.css), not a variable. Pure, so `node src/lib/mermaid-theme.check.mts` runs it bare.

/** The `--rgb-*` tokens (RGB triplets like "124 106 247") and the mono font stack (labels are set in mono, like IDs), keyed without the prefix. */
export const MERMAID_TOKENS = ["bg", "surface", "surface2", "border2", "txt", "muted"] as const
export type MermaidTokens = Partial<Record<(typeof MERMAID_TOKENS)[number] | "fontMono", string>>

/** "124 106 247" (or "124, 106, 247") → "#7c6af7"; a hex value passes through. Mermaid derives shades with khroma, which wants hex. */
export function toHex(value: string | undefined, fallback: string): string {
  const v = value?.trim() ?? ""
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  const parts = v.split(/[\s,]+/).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return fallback
  return "#" + parts.map((n) => n.toString(16).padStart(2, "0")).join("")
}

export function mermaidThemeVariables(tokens: MermaidTokens, dark: boolean): Record<string, string | boolean> {
  const c = (k: (typeof MERMAID_TOKENS)[number], light: string, dk: string) => toHex(tokens[k], dark ? dk : light)
  const bg = c("bg", "#ffffff", "#0a0a0f")
  const surface = c("surface", "#f8f8fc", "#111118")
  const surface2 = c("surface2", "#f0f0f8", "#16161f")
  const rule = c("border2", "#d0d0e4", "#2d2d3d")
  const ink = c("txt", "#1a1a2e", "#e8e8f0")
  const muted = c("muted", "#6b6b80", "#8c8ca0")
  const mono = tokens.fontMono?.trim()
  return {
    darkMode: dark,
    // the page shows through (globals.css keeps the svg unfilled); bg is what khroma derives from and edge labels sit on
    background: bg,
    fontFamily: `${mono ? mono + ", " : ""}ui-monospace, Menlo, monospace`,
    fontSize: "13px",
    // flat, ruled surfaces: no drop shadow under nodes (Mermaid 12 adds one by default)
    dropShadow: "none",
    primaryColor: surface,
    primaryTextColor: ink,
    primaryBorderColor: rule,
    secondaryColor: surface2,
    secondaryTextColor: ink,
    secondaryBorderColor: rule,
    tertiaryColor: bg,
    tertiaryTextColor: ink,
    tertiaryBorderColor: rule,
    mainBkg: surface,
    nodeBorder: rule,
    nodeTextColor: ink,
    textColor: ink,
    titleColor: ink,
    // edges in muted ink: a rule-line arrow on white is 1.4:1, too faint to follow
    lineColor: muted,
    edgeLabelBackground: bg,
    clusterBkg: bg,
    clusterBorder: rule,
    // sequence
    actorBkg: surface,
    actorBorder: rule,
    actorTextColor: ink,
    actorLineColor: rule,
    signalColor: muted,
    signalTextColor: ink,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: rule,
    labelTextColor: ink,
    loopTextColor: ink,
    noteBkgColor: surface2,
    noteBorderColor: rule,
    noteTextColor: ink,
    activationBkgColor: surface2,
    activationBorderColor: rule,
    sequenceNumberColor: bg,
    // state
    labelColor: ink,
    altBackground: surface2,
    transitionColor: muted,
    transitionLabelColor: ink,
    stateLabelColor: ink,
    specialStateColor: muted,
    innerEndBackground: muted,
  }
}
