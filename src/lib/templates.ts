export interface Template {
  id: string
  name: string
  description: string
  defaultPath: string
  content: string
}

const today = new Date().toISOString().split('T')[0]

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Empty markdown file',
    defaultPath: 'docs/untitled.md',
    content: '# Untitled\n\n',
  },
  {
    id: 'claude-md',
    name: 'CLAUDE.md',
    description: 'AI agent instructions for Claude Code',
    defaultPath: 'CLAUDE.md',
    content: '# Project Instructions\n\n## What this is\n\n## Stack\n\n## Commands\n```bash\n# install\n# dev\n# build\n```\n\n## Key conventions\n\n## Non-negotiables\n',
  },
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    description: 'AI agent instructions (multi-agent)',
    defaultPath: 'AGENTS.md',
    content: '# Agent Instructions\n\n## Overview\n\n## Agents\n\n### Agent 1\n- **Role:**\n- **Tools:**\n\n## Shared conventions\n',
  },
  {
    id: 'prd',
    name: 'Product Requirements',
    description: 'Product requirements document',
    defaultPath: 'docs/prd.md',
    content: `# Product Requirements\n\n**Status:** Draft\n**Last updated:** ${today}\n\n## Problem\n\n## Goals\n\n## Non-goals\n\n## Requirements\n\n### Functional\n\n### Non-functional\n\n## Open questions\n`,
  },
  {
    id: 'architecture-overview',
    name: 'Architecture Overview',
    description: 'System architecture doc',
    defaultPath: 'docs/architecture/overview.md',
    content: `# Architecture Overview\n\n**Last updated:** ${today}\n\n## Diagram\n\n\`\`\`mermaid\ngraph TB\n    A[Client] --> B[API]\n    B --> C[DB]\n\`\`\`\n\n## Components\n\n## Key decisions\n`,
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    description: 'API endpoints reference',
    defaultPath: 'docs/api-reference.md',
    content: '# API Reference\n\n## Base URL\n\n```\nhttps://api.example.com/v1\n```\n\n## Authentication\n\n## Endpoints\n\n### GET /resource\n\n**Response:**\n```json\n{}\n```\n',
  },
  {
    id: 'runbook',
    name: 'Runbook',
    description: 'Operational runbook',
    defaultPath: 'docs/runbook.md',
    content: `# Runbook\n\n**Last updated:** ${today}\n\n## Overview\n\n## Procedures\n\n### Deploy\n\n### Rollback\n\n### Troubleshooting\n\n## Contacts\n`,
  },
  {
    id: 'adr',
    name: 'Architecture Decision',
    description: 'Architecture Decision Record',
    defaultPath: 'docs/architecture/decisions/ADR-001.md',
    content: `# ADR-001: Title\n\n**Status:** Proposed\n**Date:** ${today}\n\n## Context\n\n## Decision\n\n## Rationale\n\n## Consequences\n`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Meeting notes template',
    defaultPath: `docs/meetings/${today}.md`,
    content: `# Meeting Notes — ${today}\n\n**Attendees:**\n\n## Agenda\n\n## Notes\n\n## Action items\n\n| Action | Owner | Due |\n|--------|-------|-----|\n|        |       |     |\n`,
  },
  {
    id: 'onboarding',
    name: 'Onboarding Guide',
    description: 'Developer onboarding guide',
    defaultPath: 'docs/onboarding.md',
    content: `# Developer Onboarding\n\n**Last updated:** ${today}\n\n## Setup\n\n\`\`\`bash\ngit clone <repo>\nnpm install\nnpm run dev\n\`\`\`\n\n## Project structure\n\n## Key concepts\n\n## Who to ask\n`,
  },
]
