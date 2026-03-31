import type { Template } from './types'

export const MONITORING_TEMPLATES: Template[] = [
  {
    id: 'health-check-doc',
    name: 'Health Check Guide',
    description: 'Health check endpoint documentation with Kubernetes config',
    defaultPath: 'docs/health-checks.md',
    category: 'monitoring',
    content: `# Health Checks — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Overview

Health check endpoints allow load balancers and orchestrators to verify service status.

## Endpoints

| Endpoint | Purpose | Auth required |
|----------|---------|---------------|
| \`GET /health\` | Liveness probe — is the process running? | No |
| \`GET /health/ready\` | Readiness probe — can the service handle traffic? | No |
| \`GET /health/detailed\` | Full dependency status | Yes (internal) |

## Liveness Check (\`GET /health\`)

Returns 200 if the process is alive, regardless of dependency status.

\`\`\`json
{"status": "ok", "uptime": 1234}
\`\`\`

## Readiness Check (\`GET /health/ready\`)

Returns 200 only if all critical dependencies are healthy.

\`\`\`json
{
  "status": "ready",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "external_api": "degraded"
  }
}
\`\`\`

Returns 503 if any critical dependency is unhealthy.

## Kubernetes Configuration

\`\`\`yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`
`,
  },
  {
    id: 'slo-doc',
    name: 'SLO/SLA Document',
    description: 'Service Level Objectives with error budget and burn rate alerts',
    defaultPath: 'docs/slo.md',
    category: 'monitoring',
    content: `# Service Level Objectives — {{PROJECT_NAME}}

**Last updated:** {{DATE}}
**Owner:** Platform Team

## Availability SLO

| Metric | Target | Error Budget (30 days) |
|--------|--------|----------------------|
| Availability | 99.9% | 43.8 minutes |
| Success rate | 99.5% | — |

## Latency SLO

| Percentile | Target |
|------------|--------|
| p50 | < 100ms |
| p95 | < 500ms |
| p99 | < 1000ms |

## Error Budget Policy

| Burn Rate | Alert Window | Severity | Action |
|-----------|-------------|----------|--------|
| > 14.4x | 1 hour | Critical | Page on-call immediately |
| > 6x | 6 hours | High | Page on-call |
| > 3x | 24 hours | Medium | Ticket + monitor |
| > 1x | 72 hours | Low | Review in standup |

## Consequences of Exhausting Error Budget

- Feature freeze until budget replenishes
- Reliability sprint prioritized over new features
- Post-mortem required for any budget burn > 50%

## Measurement

- Uptime tracked via synthetic monitoring (Pingdom / UptimeRobot)
- Latency tracked via APM (Datadog / New Relic)
- Error rate from application logs + Sentry
`,
  },
  {
    id: 'incident-runbook',
    name: 'Incident Runbook',
    description: 'Incident response runbook with severity levels and escalation',
    defaultPath: 'docs/incident-runbook.md',
    category: 'monitoring',
    content: `# Incident Runbook — {{PROJECT_NAME}}

**Last updated:** {{DATE}}

## Severity Levels

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| P0 | Complete outage, all users affected | 15 minutes | Site down |
| P1 | Major feature broken, >50% users affected | 30 minutes | Login broken |
| P2 | Significant degradation, subset of users | 2 hours | Slow API |
| P3 | Minor issue, workaround available | Next business day | Cosmetic bug |

## Roles

| Role | Responsibility |
|------|---------------|
| Incident Commander (IC) | Owns resolution, coordinates team, communicates status |
| Tech Lead | Diagnoses root cause, coordinates fixes |
| Comms Lead | Updates status page, notifies stakeholders |

## Response Process

### 0–15 minutes (Detect & Triage)
1. Confirm the incident (not a false alarm)
2. Assign Incident Commander
3. Create incident Slack channel: \`#incident-YYYYMMDD-description\`
4. Set severity level
5. Start incident timeline document

### 15–60 minutes (Investigate)
1. Identify scope: what's broken, who's affected
2. Check recent deployments (\`git log\`, deployment history)
3. Review error rates and logs
4. Consider rollback if recent deploy is suspected

### Mitigation
1. Apply fix or rollback
2. Monitor for improvement
3. Update status page
4. Notify stakeholders

## Post-Incident Checklist

- [ ] Incident resolved and verified
- [ ] Status page updated to "resolved"
- [ ] Stakeholders notified
- [ ] Timeline documented
- [ ] Post-mortem scheduled (P0/P1) or ticket created (P2)
- [ ] Action items created in project tracker
`,
  },
  {
    id: 'postmortem',
    name: 'Postmortem Template',
    description: 'Blameless postmortem template with five-whys and action items',
    defaultPath: 'docs/postmortem-template.md',
    category: 'monitoring',
    content: `# Postmortem: [Title]

**Date:** {{DATE}}
**Severity:** P[0-3]
**Duration:**
**Author:**
**Reviewers:**

> This postmortem follows a blameless culture. We focus on systems and processes, not individuals.

## Summary

<!-- 2-3 sentence summary: what happened, why it matters, what we're doing about it -->

## Impact

- **Users affected:**
- **Duration:**
- **Revenue impact:**
- **Data loss:**

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 00:00 | Monitoring alert fired |
| 00:05 | On-call engineer paged |
| 00:15 | Incident confirmed, IC assigned |
| 00:30 | Root cause identified |
| 01:00 | Fix deployed |
| 01:15 | Incident resolved |

## Root Cause Analysis (Five Whys)

**Problem:** [Describe the issue]

1. **Why?** [First cause]
2. **Why?** [Second cause]
3. **Why?** [Third cause]
4. **Why?** [Fourth cause]
5. **Why?** [Root cause]

## What Went Well

-
-

## What Could Have Gone Better

-
-

## Action Items

| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
|        |       |          | P[0-3]   |

## Lessons Learned

<!-- Key takeaways to share with the wider team -->
`,
  },
]
