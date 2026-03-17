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

### Context (C4 Level 1)

\`\`\`mermaid
graph TB
    User["User"] --> System["{{PROJECT_NAME}}"]
    System --> ExternalAPI["External APIs"]
    System --> DB["Database"]
\`\`\`

### Container (C4 Level 2)

\`\`\`mermaid
graph TB
    Client["Web Client<br/>(Browser)"] --> API["API Server<br/>(Node.js)"]
    API --> DB["Database<br/>(PostgreSQL)"]
    API --> Cache["Cache<br/>(Redis)"]
    API --> Queue["Job Queue"]
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

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
|          |        |             |           |

## ADR log

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 |       | Accepted | {{DATE}} |

## Non-goals

- <!-- What this system explicitly does NOT do -->

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

## Versioning

This API uses URL-based versioning (\`/v1/\`, \`/v2/\`, etc.).

- The current stable version is \`v1\`.
- Deprecated versions are supported for 12 months after a new version is released.
- Breaking changes always increment the major version.

## Authentication

All requests require a bearer token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

### Token refresh

Tokens expire after 1 hour. Refresh using:

\`\`\`
POST /auth/refresh
Content-Type: application/json

{"refreshToken": "<refresh_token>"}
\`\`\`

**Response:**
\`\`\`json
{"accessToken": "...", "refreshToken": "...", "expiresIn": 3600}
\`\`\`

## Rate limiting

- **Limit:** 1000 requests/hour per API key
- **Headers:** \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Pagination

List endpoints support cursor-based pagination:

\`\`\`
GET /resources?cursor=<cursor>&limit=20
\`\`\`

## Error format

All errors follow a standard envelope:

\`\`\`json
{
  "code": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "details": [{"field": "email", "issue": "invalid format"}]
}
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

## Webhooks

### Signature verification

All webhook payloads are signed with HMAC-SHA256. Verify the signature:

\`\`\`
X-Webhook-Signature: sha256=<hmac_hex>
\`\`\`

\`\`\`typescript
import crypto from 'crypto'

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(\`sha256=\${expected}\`),
    Buffer.from(signature)
  )
}
\`\`\`

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

## Escalation matrix

| Time since incident | Contact | Method |
|--------------------|---------|--------|
| 0–15 min | On-call engineer | PagerDuty / phone |
| 15–30 min | Team lead | Slack + phone |
| 30+ min | Engineering manager | Phone + email |

## Procedures

### Deploy

1.
2.
3.

### Rollback

**When to rollback:**

| Signal | Action |
|--------|--------|
| Error rate > 1% after deploy | Immediate rollback |
| P95 latency doubled | Rollback if no fix in 15 min |
| Health check failing | Immediate rollback |
| Critical bug reported | Rollback within 30 min |

**Rollback steps:**

\`\`\`bash
# 1. Identify last stable release
git log --oneline --tags --simplify-by-decoration | head -5

# 2. Deploy previous version
git checkout <previous-tag>
npm run build && npm run deploy

# 3. Verify rollback
curl -f https://your-app.com/health
\`\`\`

### Troubleshooting

#### High error rate
\`\`\`bash
# Check recent application logs
tail -f /var/log/app/error.log

# Check error counts by endpoint
grep "ERROR" /var/log/app/app.log | awk '{print $5}' | sort | uniq -c | sort -rn | head -10

# Review recent deploys
git log --oneline -10
\`\`\`

1. Check application logs for exception traces
2. Check downstream dependencies (database, cache, external APIs)
3. Review recent deploys — consider rollback if deploy-correlated

#### High latency
\`\`\`bash
# Check database slow query log
psql $DATABASE_URL -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check cache hit rate
redis-cli info stats | grep hit_rate

# Check CPU/memory
top -b -n 1 | head -20
\`\`\`

1. Check database query times (slow query log)
2. Check cache hit rates
3. Review resource utilization (CPU, memory, connections)

#### Service won't start
\`\`\`bash
# Check environment variables
env | grep -E "DATABASE|REDIS|PORT"

# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check port availability
lsof -i :3000
\`\`\`

#### Database connection issues
\`\`\`bash
# Check connection pool status
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Check max connections
psql $DATABASE_URL -c "SHOW max_connections;"
\`\`\`

#### Memory leak suspected
\`\`\`bash
# Monitor memory over time
watch -n 5 'ps aux --sort=-%mem | head -5'

# Capture heap snapshot (Node.js)
kill -USR2 <pid>
\`\`\`
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

## Day 1: Get running

- [ ] Clone the repository and set up local environment
- [ ] Run the app locally and verify it works
- [ ] Read the architecture overview (\`docs/architecture/overview.md\`)
- [ ] Meet your team lead and get a tour of the codebase

\`\`\`bash
# Clone
git clone {{REPO_URL}}
cd {{PROJECT_NAME}}

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with real values (ask your team lead)

# Start development server
npm run dev
\`\`\`

## Week 1: Get productive

- [ ] Complete the environment setup checklist below
- [ ] Read \`CONTRIBUTING.md\` and understand the PR process
- [ ] Submit your first PR (even a small doc fix counts)
- [ ] Attend team standup and sprint planning
- [ ] Review 2–3 recent merged PRs to understand code patterns
- [ ] Shadow a code review

## Month 1: Get comfortable

- [ ] Deliver your first feature end-to-end
- [ ] Lead a code review
- [ ] Identify one piece of tech debt and create a ticket
- [ ] Update this onboarding doc with anything that was unclear

## Environment setup

\`\`\`bash
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

## Common pitfalls

1. **Forgetting to copy .env.local** — the app won't start without required env vars. Copy from \`.env.example\` and fill in real values.
2. **Running \`npm install\` instead of the project's package manager** — check \`package.json\` for the \`packageManager\` field or look for a lock file (\`pnpm-lock.yaml\`, \`yarn.lock\`).
3. **Committing to \`main\` directly** — always branch and open a PR. Direct pushes to \`main\` are blocked.
4. **Skipping tests** — CI will catch you, but it's faster to run \`npm test\` locally before pushing.
5. **Not reading existing patterns** — before adding a new abstraction, search the codebase for how similar problems are solved.

## Your first PR

1. Pick a small, well-defined issue labelled \`good first issue\`
2. Create a branch: \`git checkout -b feat/your-name-first-pr\`
3. Make the change and add a test
4. Open a PR with the PR template filled out
5. Ask for a review in the team Slack channel

## Key contacts

| Role | Name | Contact |
|------|------|---------|
|      |      |         |

## Resources
- Architecture overview: \`docs/architecture/overview.md\`
- API reference: \`docs/api-reference.md\`
- Runbook: \`docs/runbook.md\`
- Contributing guide: \`CONTRIBUTING.md\`
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
