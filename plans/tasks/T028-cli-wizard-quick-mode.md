# T028 — CLI Setup Wizard: Quick Mode (`npx vibedoc`)
**Status:** ✅ Done
**Phase:** 4 — CLI & Distribution
**Size:** M (2–3 hrs)
**Depends on:** —

## What to build
A `npx vibedoc` interactive terminal wizard that runs in any project directory. The user answers 7 questions about their project, selects which documents to generate, and the CLI writes pre-filled markdown files to disk. No API key required — templates have `{{PLACEHOLDER}}` tokens replaced with user answers.

This is the primary onboarding experience: run once in a new project, get CLAUDE.md + docs structure ready for vibe coding in under 2 minutes.

## Scope
- [ ] `lib/templates.json` — 9 template definitions (single source of truth; used by both CLI and UI)
- [ ] `bin/vibedoc.mjs` — CLI entry point with interactive wizard (Quick mode)
- [ ] `src/lib/templates.ts` — TypeScript wrapper that imports `lib/templates.json` (for T021 UI to use)
- [ ] Update `package.json`: add `bin` field, add `@clack/prompts` dep, remove `"private": true`

## Files to create
- `lib/templates.json` — template registry
- `bin/vibedoc.mjs` — the CLI wizard
- `src/lib/templates.ts` — TypeScript re-export of the JSON

## Files to modify
- `package.json` — add `bin`, `@clack/prompts`, remove `private`

## New dependencies
```
@clack/prompts ^0.9.0   (terminal wizard UI — spinner, select, multiselect, text, confirm)
```

## Wizard flow

### Step 1 — Project detection (auto, no prompt)
- Read `package.json` in `process.cwd()` for project name + description
- Check if `CLAUDE.md` or `.vibedoc-activity.json` already exists → if yes, `confirm()` before continuing

### Step 2 — Mode selection
```
◆ Choose setup mode:
  ● Quick mode  (fill templates with your answers — no API key needed)
  ○ Full mode (AI-generated)  (Claude AI writes custom content — requires API key)
```
Quick mode is scope of this task. Full mode shown as an option but leads to "coming soon" message.

### Step 3 — Question wizard (7 questions via `group()`)
1. **Project name** — `text()`, pre-filled from package.json
2. **Project type** — `select()`: web app | API/backend | CLI tool | library/SDK | mobile app | monorepo
3. **Tech stack** — `text()`, e.g. "Next.js, TypeScript, PostgreSQL"
4. **Description** — `text()`, pre-filled from package.json description
5. **Key features** — `text()`, comma-separated, optional
6. **Coding conventions** — `text()`, optional (e.g. "ESLint Airbnb, Conventional Commits")
7. **Team context** — `select()`: solo developer | small team (2–5) | larger team (6+)

### Step 4 — Document selection (`groupMultiselect()`)
```
Recommended:
  ■ 🤖 CLAUDE.md        AI agent instructions
  ■ 🧠 AGENTS.md        Cross-tool agent config

Documentation:
  □ 📋 PRD              Product Requirements Document
  □ 🏗️ Architecture     Architecture Overview
  □ 🔌 API Reference    REST/GraphQL API docs
  □ 📖 Runbook          Operational procedures
  □ ⚖️  ADR              Architecture Decision Record
  □ 📝 Meeting Notes    Structured meeting notes
  □ 👋 Onboarding       Developer onboarding guide
```

### Step 5 — Preview + confirm
- `note()` listing all file paths to be written
- `confirm()` before writing
- For each file: skip (with `log.warn()`) if path already exists; write otherwise
- `spinner()` while writing

### Step 6 — Post-setup output (`outro()`)
```
✓ VibeDoc initialized!

Start the VibeDoc server:
  cd /path/to/vibedoc-app
  VIBEDOC_ROOT=/current/project/path pnpm dev

Add MCP to Claude Code (~/.claude/claude.json):
  "mcpServers": { "vibedoc": { "url": "http://localhost:3000/api/mcp" } }

Open the UI: http://localhost:3000
```

## Placeholder token system
Templates use `{{TOKEN}}` which gets replaced at write time:

| Token | Value |
|-------|-------|
| `{{PROJECT_NAME}}` | wizard answer |
| `{{PROJECT_TYPE}}` | wizard answer |
| `{{TECH_STACK}}` | wizard answer |
| `{{DESCRIPTION}}` | wizard answer |
| `{{KEY_FEATURES}}` | formatted as `- item\n- item` |
| `{{CONVENTIONS}}` | wizard answer |
| `{{TEAM_CONTEXT}}` | wizard answer |
| `{{DATE}}` | `new Date().toISOString().split('T')[0]` |

## lib/templates.json structure
```json
{
  "templates": [
    {
      "id": "claude-md",
      "name": "CLAUDE.md",
      "description": "AI agent instructions for Claude Code",
      "icon": "🤖",
      "defaultPath": "CLAUDE.md",
      "content": "# {{PROJECT_NAME}} — Agent Instructions\n\n## What this is\n{{DESCRIPTION}}\n..."
    }
  ]
}
```
9 templates with IDs: `claude-md`, `agents-md`, `prd`, `architecture-overview`, `api-reference`, `runbook`, `adr`, `meeting-notes`, `onboarding`. IDs must match T021 exactly.

## src/lib/templates.ts
```typescript
import rawTemplates from '../../lib/templates.json'

export interface Template {
  id: string
  name: string
  description: string
  icon: string
  defaultPath: string
  content: string
}

export const TEMPLATES: Template[] = rawTemplates.templates

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export function applyPlaceholders(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}
```
Requires `"resolveJsonModule": true` in tsconfig.json (already set).

## bin/vibedoc.mjs key patterns

```javascript
#!/usr/bin/env node
import { intro, outro, text, select, multiselect, groupMultiselect,
         confirm, spinner, cancel, isCancel, note, log, group, password } from '@clack/prompts'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { templates: TEMPLATES } = require('../lib/templates.json')  // JSON import
```

File write (skip if exists):
```javascript
for (const file of filesToWrite) {
  const fullPath = path.join(cwd, file.path)
  try { await access(fullPath); skipped.push(file.path) }
  catch {
    await mkdir(path.dirname(fullPath), { recursive: true })
    await writeFile(fullPath, file.content, 'utf8')
    written.push(file.path)
  }
}
```

Ctrl+C / cancel at any point:
```javascript
if (isCancel(value)) { cancel('Setup cancelled.'); process.exit(0) }
```

## package.json changes
```json
{
  // remove: "private": true
  "bin": { "vibedoc": "./bin/vibedoc.mjs" },
  "files": ["bin/", "lib/", "src/", "public/"],
  "dependencies": {
    "@clack/prompts": "^0.9.0"
  }
}
```

## Acceptance criteria
- [ ] `node ./bin/vibedoc.mjs` runs without errors from any directory
- [ ] All 7 questions appear in order; Ctrl+C at any point exits cleanly
- [ ] Existing CLAUDE.md triggers re-initialize confirmation
- [ ] Quick mode writes files with all `{{TOKEN}}` replaced (no raw tokens in output)
- [ ] Files already on disk are skipped with a warning, not overwritten
- [ ] Post-setup output shows the exact `VIBEDOC_ROOT=<cwd> pnpm dev` command
- [ ] `pnpm build` passes (templates.ts JSON import resolves correctly)
- [ ] `pnpm lint` passes (bin/ not scanned by next/core-web-vitals)
- [ ] Full mode option shown in step 2 but displays "coming soon — see T029"

## Do NOT
- Don't write TypeScript in `bin/vibedoc.mjs` — it must be plain JavaScript ESM
- Don't import from `src/lib/core.ts` in the CLI — the CLI is standalone, use `fs/promises` directly
- Don't overwrite existing files silently — always skip with a warning

## Definition of done
`node ./bin/vibedoc.mjs` in a fresh directory → complete the wizard → `CLAUDE.md` and selected docs exist with project name and stack filled in. `pnpm build` passes.
