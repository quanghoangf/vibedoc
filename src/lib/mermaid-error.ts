// A Mermaid error, read for a person (R096): which line, and what went wrong in words instead of the parser's token
// list ("Expecting 'AMP', 'COLON', … got 'LINK'"). The component maps `kind` to UI text. Pure:
// `node src/lib/mermaid-error.check.mts`.

/** arrow: an arrow where a box was expected · end: the line stops too early · text: characters Mermaid can't read ·
 *  type: the first line names no diagram type · other: anything else (the raw message stays under Details). */
export type MermaidErrorKind = "arrow" | "end" | "text" | "type" | "other"

export interface MermaidError { line: number | null; kind: MermaidErrorKind; raw: string }

const ARROW_TOKENS = new Set(["LINK", "START_LINK", "ARROW", "SOLID_ARROW", "DOTTED_ARROW", "THICK_ARROW", "--", "-->"])
const END_TOKENS = new Set(["EOF", "NEWLINE", "SPACE", "SEMI"])

export function explainMermaidError(error: unknown): MermaidError {
  const raw = String((error as { message?: unknown })?.message ?? error ?? "").trim()
  const line = /\bon line (\d+)/i.exec(raw)?.[1]
  const got = /\bgot '([^']+)'/.exec(raw)?.[1]
  const kind: MermaidErrorKind =
    /no diagram type detected|unknowndiagramerror/i.test(raw) ? "type"
    : /^lexical error/i.test(raw) ? "text"
    : got && ARROW_TOKENS.has(got) ? "arrow"
    : got && END_TOKENS.has(got) ? "end"
    : "other"
  // an unknown type is always the first line
  return { line: line ? Number(line) : kind === "type" ? 1 : null, kind, raw }
}
