import type { Template } from './types'

const today = new Date().toISOString().split('T')[0]

export const TECHNICAL_TEMPLATES: Template[] = [
  {
    id: 'prd',
    name: 'PRD',
    description: 'Product requirements document',
    defaultPath: 'docs/prd.md',
    category: 'technical',
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
    category: 'technical',
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
    category: 'technical',
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
    category: 'technical',
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
    category: 'technical',
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
    id: 'onboarding',
    name: 'Onboarding Guide',
    description: 'Developer onboarding guide',
    defaultPath: 'docs/onboarding.md',
    category: 'technical',
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
    id: 'database',
    name: 'Database Docs',
    description: 'Database schema and design reference',
    defaultPath: 'docs/DATABASE.md',
    category: 'technical',
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
    category: 'technical',
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
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Meeting notes template',
    defaultPath: `docs/meetings/${today}.md`,
    category: 'technical',
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
    id: 'blank',
    name: 'Blank Document',
    description: 'Empty markdown file',
    defaultPath: 'docs/untitled.md',
    category: 'technical',
    content: '# Untitled\n\n',
  },
]
