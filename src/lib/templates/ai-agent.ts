import type { Template } from './types'

export const AI_AGENT_TEMPLATES: Template[] = [
  {
    id: 'claude-md',
    name: 'CLAUDE.md',
    description: 'AI agent instructions for Claude Code',
    defaultPath: 'CLAUDE.md',
    category: 'ai-agent',
    content: `# {{PROJECT_NAME}} — Agent Instructions

## What this is
{{DESCRIPTION}}

## Stack
{{TECH_STACK}}

## Project type
{{PROJECT_TYPE}}

## Commands
\`\`\`bash
# Install dependencies
{{PACKAGE_MANAGER}} install

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Architecture
- Primary language: {{PRIMARY_LANGUAGE}}
- Deployment: {{DEPLOYMENT_PLATFORM}}
- Key directories: \`src/\`, \`docs/\`, \`tests/\`
- See \`docs/architecture/overview.md\` for full details

## Read before coding
- @docs/architecture/overview.md
- @CONTRIBUTING.md

## Key conventions
{{CONVENTIONS}}

## Key features
{{KEY_FEATURES}}

## Non-negotiables
- Always run \`npm run build\` before marking a task done — build must pass
- Never use localStorage — causes SSR/client mismatch
- Never commit secrets or credentials
- Maintain test coverage
- Follow security best practices

## Code style
- Follow existing patterns before introducing new abstractions
- Keep modules small and focused
- Write tests for business logic
- Prefer explicit over implicit
`,
  },
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    description: 'AI agent instructions (multi-agent / OpenAI)',
    defaultPath: 'AGENTS.md',
    category: 'ai-agent',
    content: `# {{PROJECT_NAME}} — Agent Instructions

## Overview
{{DESCRIPTION}}

## Stack
{{TECH_STACK}}

## Commands
\`\`\`bash
npm install
npm run dev
npm run build
npm test
\`\`\`

## Key conventions
{{CONVENTIONS}}

## Non-negotiables
- Follow existing code patterns
- Write tests for new features
- Never commit secrets or credentials
`,
  },
  {
    id: 'gemini-md',
    name: 'GEMINI.md',
    description: 'AI agent instructions for Gemini CLI',
    defaultPath: 'GEMINI.md',
    category: 'ai-agent',
    content: `# {{PROJECT_NAME}} — Gemini Agent Instructions

## What this is
{{DESCRIPTION}}

## Stack
{{TECH_STACK}}

## Commands
\`\`\`bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Key conventions
{{CONVENTIONS}}

## Non-negotiables
- Follow existing code patterns
- Write tests for new features
- Never commit secrets or credentials
`,
  },
  {
    id: 'cursorrules',
    name: '.cursorrules',
    description: 'Cursor IDE rules for AI assistance',
    defaultPath: '.cursorrules',
    category: 'ai-agent',
    content: `# {{PROJECT_NAME}} — Cursor Rules

## Project overview
{{DESCRIPTION}}

## Tech stack
{{TECH_STACK}}

## Code style
- Use {{TECH_STACK}} conventions
- Follow existing patterns in the codebase
- Prefer explicit over implicit
- Keep functions small and focused

## Conventions
{{CONVENTIONS}}

## What NOT to do
- Don't introduce new dependencies without discussion
- Don't break existing tests
- Don't commit secrets or credentials
- Don't over-engineer simple solutions
`,
  },
  {
    id: 'windsurfrules',
    name: '.windsurfrules',
    description: 'Windsurf IDE rules for AI assistance',
    defaultPath: '.windsurfrules',
    category: 'ai-agent',
    content: `# {{PROJECT_NAME}} — Windsurf Rules

## Project overview
{{DESCRIPTION}}

## Tech stack
{{TECH_STACK}}

## Code style
- Follow existing patterns in the codebase
- Prefer explicit over implicit
- Keep functions small and focused

## Conventions
{{CONVENTIONS}}

## Non-negotiables
- Don't introduce breaking changes
- Don't commit secrets or credentials
- Maintain test coverage
`,
  },
  {
    id: 'copilot-instructions',
    name: 'Copilot Instructions',
    description: 'GitHub Copilot custom instructions',
    defaultPath: '.github/copilot-instructions.md',
    category: 'ai-agent',
    content: `# GitHub Copilot Instructions — {{PROJECT_NAME}}

## Project overview
{{DESCRIPTION}}

## Tech stack
{{TECH_STACK}}

## Coding conventions
{{CONVENTIONS}}

## Key features
{{KEY_FEATURES}}

## Style guidelines
- Follow existing patterns before creating new abstractions
- Write descriptive variable and function names
- Add comments for non-obvious logic only
- Keep functions focused on a single responsibility

## Testing
- Write tests for all new functionality
- Maintain existing test coverage
- Use the project's established testing patterns
`,
  },
]
