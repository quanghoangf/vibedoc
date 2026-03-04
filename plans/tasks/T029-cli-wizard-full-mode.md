# T029 — CLI Setup Wizard: Full Mode (Claude API)
**Status:** ✅ Done
**Phase:** 4 — CLI & Distribution
**Size:** M (2 hrs)
**Depends on:** T028 (wizard skeleton must exist)

## What to build
Extend the `npx vibedoc` wizard with a **Full mode** that sends the user's project answers to the Claude API (claude-sonnet-4-6) and streams back fully custom, project-specific documentation. Instead of replacing `{{TOKENS}}` in generic templates, Claude writes the actual content — producing a richer, tailored CLAUDE.md, architecture docs, PRD, etc.

## Scope
- [ ] API key handling: check `ANTHROPIC_API_KEY` env var; if missing, prompt with masked `password()` input
- [ ] Build a structured system prompt instructing Claude to output docs with `===FILE: path===` delimiters
- [ ] Stream Claude API response using `@anthropic-ai/sdk`, updating the spinner with the current filename
- [ ] Parse the streamed output into `{ path, content }[]` using the delimiter format
- [ ] Show a preview (`note()`) of first 400 chars per generated file before confirming write
- [ ] Graceful fallback: API error or parse failure → offer Quick mode as backup
- [ ] Add `@anthropic-ai/sdk` to `package.json` dependencies
- [ ] Wire Full mode into the existing T028 wizard flow (replace the "coming soon" stub)

## Files to modify
- `bin/vibedoc.mjs` — add Full mode branch (all changes are here)
- `package.json` — add `@anthropic-ai/sdk` dependency

## New dependencies
```
@anthropic-ai/sdk ^0.39.0   (Claude API with streaming support)
```

## Implementation details

### Dynamic import (important)
Load the SDK only when Full mode is actually selected — avoids startup cost for Quick mode users and fails gracefully if the package isn't installed:
```javascript
// Inside generateWithClaude() only — NOT at top of file
const { default: Anthropic } = await import('@anthropic-ai/sdk')
```

### API key handling
```javascript
async function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  const key = await password({
    message: 'Enter your ANTHROPIC_API_KEY (input is hidden):',
    validate: v => v.trim().startsWith('sk-ant-') ? undefined : 'Key must start with sk-ant-'
  })
  if (isCancel(key)) { cancel('Setup cancelled.'); process.exit(0) }
  return key
}
```

### System prompt
Instructs Claude to output ONLY the file delimiter blocks — no preamble, no commentary:
```
You are a technical documentation writer for software projects.
Output each requested file using this EXACT format with no other text:

===FILE: <relative/path/to/file.md>===
<full markdown content>

Rules:
- Output ONLY the ===FILE: ... === sections, nothing else before or after
- Each file must be complete and production-ready
- Tailor content specifically to the project described
- For CLAUDE.md/AGENTS.md: write actionable AI agent instructions
- For architecture docs: use Mermaid diagrams where appropriate
- Today's date: {{DATE}}
```

### User message
```javascript
function buildUserMessage(answers, selectedTemplates) {
  const fileList = selectedTemplates.map(t => `- ${t.name} → ${t.defaultPath}`).join('\n')
  return `Generate these documentation files:\n${fileList}\n\nProject:\n` +
    `- Name: ${answers.projectName}\n` +
    `- Type: ${answers.projectType}\n` +
    `- Stack: ${answers.techStack || 'not specified'}\n` +
    `- Description: ${answers.description || 'not specified'}\n` +
    `- Key features: ${answers.keyFeatures || 'not specified'}\n` +
    `- Conventions: ${answers.conventions || 'not specified'}\n` +
    `- Team: ${answers.teamContext}`
}
```

### Streaming with live spinner updates
```javascript
async function generateWithClaude(answers, selectedTemplates, apiKey) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const s = spinner()
  s.start('Connecting to Claude...')

  let fullOutput = ''
  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    stream: true,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserMessage(answers, selectedTemplates) }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullOutput += event.delta.text
      // Update spinner with current file being generated
      const match = fullOutput.match(/===FILE:\s*([^\n=]+?)===(?!.*===FILE:)/s)
      if (match) s.message(`Generating: ${match[1].trim()}`)
    }
  }
  s.stop('Generation complete.')
  return fullOutput
}
```

### Output parser
Claude's output format:
```
===FILE: CLAUDE.md===
# My App — Agent Instructions
...content...

===FILE: docs/prd.md===
# My App — PRD
...content...
```

Parser using split with capture group (captures alternate with content in JS split):
```javascript
function parseAiOutput(raw) {
  const parts = raw.split(/===FILE:\s*([^\n=]+?)===/)
  // parts: [preamble, path1, content1, path2, content2, ...]
  const files = []
  for (let i = 1; i < parts.length; i += 2) {
    const p = parts[i]?.trim()
    const c = parts[i + 1]?.trim()
    if (p && c) files.push({ path: p, content: c })
  }
  return files
}
```

### Preview before write
Show first 400 chars of each generated file so the user can spot issues before committing:
```javascript
for (const file of parsedFiles.slice(0, 4)) {
  note(
    file.content.slice(0, 400) + (file.content.length > 400 ? '\n\n...(truncated)' : ''),
    `Generated: ${file.path}`
  )
}
```

### Fallback handling
```javascript
// In main(), Full mode branch:
try {
  const raw = await generateWithClaude(answers, selectedTemplates, apiKey)
  const parsed = parseAiOutput(raw)
  if (parsed.length === 0) {
    log.warn('Could not parse AI output. Falling back to Quick mode templates.')
    filesToWrite = quickModeFiles(answers, selectedTemplates)
  } else {
    filesToWrite = parsed
    // show preview
  }
} catch (e) {
  log.error(`Claude API error: ${e.message}`)
  const fallback = await confirm({ message: 'Fall back to Quick mode (templates)?' })
  if (isCancel(fallback) || !fallback) { cancel('Aborted.'); process.exit(0) }
  filesToWrite = quickModeFiles(answers, selectedTemplates)
}
```

The same file write loop from T028 (skip if exists, mkdir, writeFile) runs after this branch resolves.

## Wizard integration
In T028, Full mode shows "coming soon". In T029:
- Replace that stub with the actual Full mode branch
- After step 4 (doc selection), the flow forks based on `mode`:
  - `'quick'` → `quickModeFiles()` → preview paths → confirm → write
  - `'full'` → `getApiKey()` → `generateWithClaude()` → `parseAiOutput()` → preview content → confirm → write

## Acceptance criteria
- [ ] `ANTHROPIC_API_KEY=sk-ant-... node ./bin/vibedoc.mjs` → Full mode skips the key prompt
- [ ] Running without the env var → masked password prompt appears
- [ ] Invalid key → API error → user offered Quick mode fallback; choosing Yes runs Quick mode
- [ ] Spinner updates with filename as it streams (e.g. "Generating: CLAUDE.md")
- [ ] Preview of generated content (≤400 chars per file) shown before confirmation
- [ ] Generated CLAUDE.md contains the actual project name and tech stack in prose (not just tokens)
- [ ] Parse failure → automatic fallback to Quick mode with a warning
- [ ] Quick mode still works unchanged (T028 regression)
- [ ] `pnpm build` passes

## Do NOT
- Don't add `@anthropic-ai/sdk` as a static top-level import — use `await import()` inside the function
- Don't store the API key to disk or any file
- Don't call the API without streaming — large doc sets can take 30+ seconds; streaming keeps the UX responsive

## Definition of done
Run wizard → pick Full mode → enter API key → spinner shows files being generated → preview appears → confirm → files written with rich AI-generated content. `pnpm build` passes.
