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
npm install

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Key architecture rules
- Follow existing patterns before introducing new abstractions
- Keep modules small and focused
- Write tests for business logic

## Key conventions
{{CONVENTIONS}}

## Key features
{{KEY_FEATURES}}

## Non-negotiables
- Keep code clean and well-documented
- Maintain test coverage
- Follow security best practices
- Never commit secrets or credentials
`,
  },
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    description: 'AI agent instructions (multi-agent / OpenAI)',
    defaultPath: 'AGENTS.md',
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
  {
    id: 'prd',
    name: 'PRD',
    description: 'Product requirements document',
    defaultPath: 'docs/prd.md',
    content: `# Product Requirements — {{PROJECT_NAME}}

**Status:** Draft
**Last updated:** {{DATE}}
**Author:**
**Stakeholders:**

## Problem statement
{{DESCRIPTION}}

## Goals
-
-

## Non-goals
-
-

## User stories
| As a... | I want to... | So that... |
|---------|--------------|------------|
| user    |              |            |

## Requirements

### Functional
{{KEY_FEATURES}}

### Non-functional
- Performance:
- Security:
- Reliability:
- Scalability:

## Success metrics
| Metric | Current | Target |
|--------|---------|--------|
|        |         |        |

## Timeline
| Milestone | Target date |
|-----------|-------------|
|           |             |

## Open questions
-
`,
  },
  {
    id: 'architecture-overview',
    name: 'Architecture Overview',
    description: 'System architecture doc',
    defaultPath: 'docs/architecture/overview.md',
    content: `# Architecture Overview — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Summary
{{DESCRIPTION}}

## Tech stack
{{TECH_STACK}}

## System diagram

\`\`\`mermaid
graph TB
    Client["Client"] --> API["API Layer"]
    API --> DB["Database"]
    API --> Cache["Cache"]
\`\`\`

## Components

| Component | Responsibility | Tech |
|-----------|---------------|------|
|           |               |      |

## Data flow

1.
2.
3.

## Key decisions
-

## Security considerations
- Authentication:
- Authorization:
- Data validation:
- Secrets management:

## Scalability notes
-
`,
  },
  {
    id: 'api-reference',
    name: 'API Reference',
    description: 'API endpoints reference',
    defaultPath: 'docs/api-reference.md',
    content: `# API Reference — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Base URL

\`\`\`
https://api.example.com/v1
\`\`\`

## Authentication

All requests require a bearer token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

## Rate limiting

- **Limit:** 1000 requests/hour per API key
- **Headers:** \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Pagination

List endpoints support cursor-based pagination:

\`\`\`
GET /resources?cursor=<cursor>&limit=20
\`\`\`

## Error codes

| Code | Meaning |
|------|---------|
| 400  | Bad request — invalid parameters |
| 401  | Unauthorized — missing or invalid token |
| 403  | Forbidden — insufficient permissions |
| 404  | Not found |
| 422  | Unprocessable entity — validation error |
| 429  | Too many requests |
| 500  | Internal server error |

## Endpoints

### GET /resource

**Description:** List resources

**Query parameters:**
- \`limit\` (integer, default 20) — items per page
- \`cursor\` (string) — pagination cursor

**Response:**
\`\`\`json
{
  "data": [],
  "cursor": null,
  "total": 0
}
\`\`\`

### POST /resource

**Description:** Create a resource

**Request body:**
\`\`\`json
{}
\`\`\`

**Response:**
\`\`\`json
{}
\`\`\`
`,
  },
  {
    id: 'runbook',
    name: 'Runbook',
    description: 'Operational runbook',
    defaultPath: 'docs/runbook.md',
    content: `# Runbook — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Overview
{{DESCRIPTION}}

## SLOs

| Metric | Target |
|--------|--------|
| Availability | 99.9% |
| P95 latency | < 500ms |
| Error rate | < 0.1% |

## Environments

| Env | URL | Purpose |
|-----|-----|---------|
| Production | | Live traffic |
| Staging | | Pre-release testing |
| Development | | Local dev |

## Alerting

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
|       |           |          |        |

## On-call contacts

| Role | Name | Contact |
|------|------|---------|
| Primary | | |
| Secondary | | |

## Procedures

### Deploy

1.
2.
3.

### Rollback

1.
2.
3.

### Troubleshooting

#### High error rate
1. Check application logs
2. Check downstream dependencies
3. Review recent deploys

#### High latency
1. Check database query times
2. Check cache hit rates
3. Review resource utilization

## Escalation path

1. On-call engineer
2. Team lead
3. Engineering manager
`,
  },
  {
    id: 'adr',
    name: 'Architecture Decision',
    description: 'Architecture Decision Record',
    defaultPath: 'docs/architecture/decisions/ADR-001.md',
    content: `# ADR-001: Title

**Status:** Proposed
**Date:** {{DATE}}
**Deciders:**

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Rationale
Why did we choose this option?

## Alternatives considered
- **Option A:** Description — pros/cons
- **Option B:** Description — pros/cons

## Consequences

### Positive
-

### Negative
-

### Neutral
-
`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Meeting notes template',
    defaultPath: `docs/meetings/${today}.md`,
    content: `# Meeting Notes — ${today}

**Attendees:**
**Facilitator:**

## Agenda

1.
2.

## Notes

## Decisions

## Action items

| Action | Owner | Due |
|--------|-------|-----|
|        |       |     |

## Next meeting
`,
  },
  {
    id: 'onboarding',
    name: 'Onboarding Guide',
    description: 'Developer onboarding guide',
    defaultPath: 'docs/onboarding.md',
    content: `# Developer Onboarding — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Overview
{{DESCRIPTION}}

## Prerequisites
- [ ] Access to repository ({{REPO_URL}})
- [ ] Access to staging environment
- [ ] Accounts: (list required accounts/services)

## Day 1 checklist
- [ ] Clone the repository
- [ ] Set up local development environment
- [ ] Run the app locally
- [ ] Read the architecture overview
- [ ] Meet the team

## Environment setup

\`\`\`bash
# Clone
git clone {{REPO_URL}}
cd {{PROJECT_NAME}}

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
\`\`\`

## Tech stack
{{TECH_STACK}}

## IDE setup
- Recommended: VS Code or Cursor
- Install recommended extensions (see \`.vscode/extensions.json\`)
- Enable format on save

## Project structure

\`\`\`
(describe key directories here)
\`\`\`

## Key concepts
-

## Common tasks

### Running tests
\`\`\`bash
npm test
\`\`\`

### Building for production
\`\`\`bash
npm run build
\`\`\`

## Key contacts

| Role | Name | Contact |
|------|------|---------|
|      |      |         |

## Resources
- Architecture overview: \`docs/architecture/overview.md\`
- API reference: \`docs/api-reference.md\`
- Runbook: \`docs/runbook.md\`
`,
  },
  {
    id: 'contributing',
    name: 'CONTRIBUTING.md',
    description: 'Contribution guidelines',
    defaultPath: 'CONTRIBUTING.md',
    content: `# Contributing to {{PROJECT_NAME}}

Thank you for your interest in contributing!

## Getting started

1. Fork the repository
2. Clone your fork: \`git clone {{REPO_URL}}\`
3. Create a feature branch: \`git checkout -b feat/your-feature\`
4. Make your changes
5. Submit a pull request

## Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | \`feat/<description>\` | \`feat/user-auth\` |
| Fix | \`fix/<description>\` | \`fix/login-crash\` |
| Chore | \`chore/<description>\` | \`chore/update-deps\` |
| Docs | \`docs/<description>\` | \`docs/api-guide\` |

## Commit conventions

We use [Conventional Commits](https://conventionalcommits.org):

\`\`\`
feat: add user authentication
fix: resolve login redirect issue
docs: update API reference
chore: upgrade dependencies
\`\`\`

## Pull request process

1. Fill out the PR template completely
2. Ensure all CI checks pass
3. Request review from at least one maintainer
4. Address all review comments
5. Squash commits before merge

## PR review checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated if needed
- [ ] No secrets or credentials in code
- [ ] Breaking changes documented

## Code style
{{CONVENTIONS}}

## Reporting bugs

Open an issue with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details
`,
  },
  {
    id: 'security',
    name: 'SECURITY.md',
    description: 'Security policy and vulnerability reporting',
    defaultPath: 'SECURITY.md',
    content: `# Security Policy — {{PROJECT_NAME}}

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ |
| < 1.0   | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a security issue, email: security@example.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. We will:
1. Confirm receipt of your report
2. Investigate and assess the issue
3. Release a fix or mitigation
4. Credit you in the release notes (unless you prefer anonymity)

## Security best practices

When contributing to this project:
- Never commit secrets, tokens, or credentials
- Use environment variables for all sensitive configuration
- Validate and sanitize all user input
- Follow the principle of least privilege
- Keep dependencies up to date
`,
  },
  {
    id: 'pr-template',
    name: 'PR Template',
    description: 'Pull request template',
    defaultPath: '.github/pull_request_template.md',
    content: `## Description

<!-- Briefly describe the changes and why they were made -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactor / code cleanup
- [ ] Dependency update

## Related issues

Closes #

## How to test

1.
2.
3.

## Screenshots / recordings

<!-- If applicable, add screenshots or screen recordings -->

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my changes
- [ ] I have added tests that prove my fix or feature works
- [ ] New and existing unit tests pass locally
- [ ] I have updated documentation if needed
- [ ] No secrets or credentials are included
`,
  },
  {
    id: 'bug-report',
    name: 'Bug Report Template',
    description: 'GitHub issue template for bugs',
    defaultPath: '.github/ISSUE_TEMPLATE/bug_report.md',
    content: `---
name: Bug report
about: Create a report to help us improve
labels: bug
---

## Describe the bug

A clear and concise description of what the bug is.

## Steps to reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected behavior

A clear and concise description of what you expected to happen.

## Actual behavior

What actually happened.

## Screenshots

If applicable, add screenshots to help explain your problem.

## Environment

- OS: [e.g. macOS 14]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 1.2.3]
- Node.js: [e.g. 20.x]

## Additional context

Add any other context about the problem here.
`,
  },
  {
    id: 'feature-request',
    name: 'Feature Request Template',
    description: 'GitHub issue template for features',
    defaultPath: '.github/ISSUE_TEMPLATE/feature_request.md',
    content: `---
name: Feature request
about: Suggest an idea for this project
labels: enhancement
---

## Problem

Is your feature request related to a problem? Please describe.
A clear and concise description of what the problem is.

## Proposed solution

A clear and concise description of what you want to happen.

## Alternatives considered

A clear and concise description of any alternative solutions or features you've considered.

## Implementation notes

Any thoughts on how this might be implemented?

## Additional context

Add any other context, mockups, or screenshots about the feature request here.
`,
  },
  {
    id: 'changelog',
    name: 'CHANGELOG.md',
    description: 'Keep a Changelog format',
    defaultPath: 'CHANGELOG.md',
    content: `# Changelog — {{PROJECT_NAME}}

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
-

### Changed
-

### Fixed
-

### Removed
-

## [1.0.0] — {{DATE}}

### Added
- Initial release
`,
  },
  {
    id: 'deployment',
    name: 'DEPLOYMENT.md',
    description: 'Deployment guide and procedures',
    defaultPath: 'DEPLOYMENT.md',
    content: `# Deployment Guide — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Environments

| Environment | URL | Branch | Auto-deploy |
|-------------|-----|--------|-------------|
| Production  | | \`main\` | No |
| Staging     | | \`develop\` | Yes |
| Preview     | | PRs | Yes |

## Prerequisites

- Access to deployment platform
- Environment variables configured (see \`.env.example\`)
- CI/CD pipeline passing

## Deploy to production

\`\`\`bash
# 1. Ensure tests pass
npm test

# 2. Build and verify
npm run build

# 3. Merge to main
git checkout main && git merge develop

# 4. Tag the release
git tag v1.x.x && git push --tags
\`\`\`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
|          | Yes      |             |

## Rollback procedure

1. Identify the last stable release tag
2. \`git checkout <tag>\`
3. Redeploy the previous version
4. Verify the rollback with smoke tests

## Smoke tests

After every deploy, verify:
- [ ] App loads at production URL
- [ ] Auth flow works
- [ ] Core features functional
- [ ] No error spikes in monitoring

## Contacts

| Role | Contact |
|------|---------|
| On-call | |
| Release manager | |
`,
  },
  {
    id: 'testing',
    name: 'TESTING.md',
    description: 'Testing strategy and guide',
    defaultPath: 'TESTING.md',
    content: `# Testing Guide — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Test strategy

| Layer | Type | Tool | Coverage target |
|-------|------|------|----------------|
| Unit | Functions/logic | {{TEST_FRAMEWORK}} | 80%+ |
| Integration | API/DB | {{TEST_FRAMEWORK}} | 70%+ |
| E2E | User flows | Playwright | Key paths |

## Running tests

\`\`\`bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
\`\`\`

## Writing tests

### Unit test example

\`\`\`typescript
describe('MyFunction', () => {
  it('should return expected value', () => {
    expect(myFunction(input)).toBe(expected)
  })
})
\`\`\`

### Integration test guidelines
- Use a real database (not mocks) for DB tests
- Reset state between tests
- Test happy path and error cases

### E2E test guidelines
- Cover critical user journeys
- Use stable selectors (\`data-testid\`)
- Run against staging environment

## Test organization

\`\`\`
src/
  __tests__/        # Unit tests
  __integration__/  # Integration tests
e2e/                # E2E tests
\`\`\`

## CI/CD

Tests run automatically on every PR. PRs cannot merge with failing tests.
`,
  },
  {
    id: 'glossary',
    name: 'Glossary',
    description: 'Project terminology reference',
    defaultPath: 'docs/glossary.md',
    content: `# Glossary — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

This document defines terms used throughout the project documentation and codebase.

## Terms

| Term | Definition |
|------|------------|
|      |            |

## Acronyms

| Acronym | Full form | Meaning |
|---------|-----------|---------|
|         |           |         |

## Domain concepts

<!-- Add domain-specific concepts here -->

---

*Keep this document updated as new terminology is introduced.*
`,
  },
  {
    id: 'database',
    name: 'Database Docs',
    description: 'Database schema and design reference',
    defaultPath: 'docs/DATABASE.md',
    content: `# Database Documentation — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Overview

<!-- Brief description of the database design -->

## Entity Relationship Diagram

\`\`\`mermaid
erDiagram
    USERS {
        uuid id PK
        string email
        timestamp created_at
    }
\`\`\`

## Tables

### users

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | No | Primary key |
| email | varchar | No | Unique email |
| created_at | timestamp | No | Creation time |

## Indexes

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
|       |         |      |         |

## Migrations

Migrations live in \`db/migrations/\`. Run with:

\`\`\`bash
npm run db:migrate
\`\`\`

## Connection

\`\`\`
DATABASE_URL=postgresql://user:password@host:5432/dbname
\`\`\`

## Backup & restore

\`\`\`bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
\`\`\`

## Performance notes

-
`,
  },
  {
    id: 'openapi',
    name: 'OpenAPI Spec',
    description: 'OpenAPI 3.0 API specification scaffold',
    defaultPath: 'docs/api-spec.yaml',
    content: `openapi: 3.0.3
info:
  title: {{PROJECT_NAME}} API
  description: |
    {{DESCRIPTION}}
  version: 1.0.0
  contact:
    email: team@example.com

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

security:
  - bearerAuth: []

paths:
  /health:
    get:
      summary: Health check
      operationId: healthCheck
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok

  /resources:
    get:
      summary: List resources
      operationId: listResources
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ResourceList'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Resource:
      type: object
      properties:
        id:
          type: string
          format: uuid
        createdAt:
          type: string
          format: date-time

    ResourceList:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/Resource'
        cursor:
          type: string
          nullable: true
        total:
          type: integer

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string

  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
`,
  },
]
