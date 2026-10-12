// Starting points for the editor's "Insert visual" menu (T518): Mermaid diagrams and R096 visual blocks. Small on
// purpose (3–5 nodes / items) so they read as a sketch to edit. The inserted markdown stays English like every file
// VibeDoc writes (R078); only the menu labels are translated.

export const DIAGRAM_TEMPLATES = {
  flowchart: ["```mermaid", "flowchart LR", "  A[Start] --> B{Decision}", "  B -->|yes| C[Do it]", "  B -->|no| D[Skip]", "  class C accent", "```"],
  sequence: ["```mermaid", "sequenceDiagram", "  User->>App: request", "  App->>API: call", "  API-->>App: result", "  App-->>User: response", "```"],
  state: ["```mermaid", "stateDiagram-v2", "  [*] --> Todo", "  Todo --> InProgress", "  InProgress --> Done", "  Done --> [*]", "```"],
  er: ["```mermaid", "erDiagram", "  USER ||--o{ ORDER : places", "  ORDER ||--|{ LINE_ITEM : contains", "  USER {", "    string id", "    string email", "  }", "```"],
} as const

export const BLOCK_TEMPLATES = {
  steps: ["<!-- vibedoc:steps -->", "1. **First step** — what happens first.", "2. **Second step** — what happens next.", "3. **Done** — the result."],
  cards: ["<!-- vibedoc:cards -->", "- **Idea one** — a short line.", "- **Idea two** — a short line.", "- **Idea three** — a short line."],
  compare: ["<!-- vibedoc:compare -->", "- **Option A** — the gist", "  - a strength", "  - a cost", "- **Option B** — the gist", "  - a strength", "  - a cost"],
  timeline: ["<!-- vibedoc:timeline -->", "1. **Done** — what shipped.", "2. **Now** — what is being built.", "3. **Next** — what comes after."],
} as const

export type DiagramTemplate = keyof typeof DIAGRAM_TEMPLATES
export type BlockTemplate = keyof typeof BLOCK_TEMPLATES

/** The block on its own lines: a blank line before it unless the cursor starts an empty line, one after. */
export function blockInsert(lines: readonly string[], lineBefore: string, atLineStart: boolean): string {
  const lead = atLineStart ? (lineBefore.trim() === "" ? "" : "\n") : "\n\n"
  return lead + lines.join("\n") + "\n\n"
}
