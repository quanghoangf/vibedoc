import type { Template } from './types'

export const GITHUB_TEMPLATES: Template[] = [
  {
    id: 'contributing',
    name: 'CONTRIBUTING.md',
    description: 'Contribution guidelines',
    defaultPath: 'CONTRIBUTING.md',
    category: 'github',
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
| Refactor | \`refactor/<description>\` | \`refactor/auth-module\` |
| Release | \`release/<version>\` | \`release/v1.2.0\` |

## Commit conventions

We use [Conventional Commits](https://conventionalcommits.org):

| Type | When to use |
|------|------------|
| \`feat\` | New feature |
| \`fix\` | Bug fix |
| \`docs\` | Documentation only |
| \`refactor\` | Code change that's neither fix nor feature |
| \`test\` | Adding or updating tests |
| \`chore\` | Build process, dependencies, tooling |
| \`perf\` | Performance improvement |
| \`ci\` | CI/CD changes |

Examples:
\`\`\`
feat: add user authentication
fix: resolve login redirect issue
docs: update API reference
chore: upgrade dependencies
feat!: redesign auth API (breaking change — note the !)
\`\`\`

## PR size guidance

| Size | Lines changed | Guidance |
|------|--------------|---------|
| Small | < 400 lines | Ideal — fast to review |
| Medium | 400–800 lines | Acceptable — add extra context in description |
| Large | > 800 lines | Needs discussion before opening — split if possible |

Large PRs slow down the team and increase the chance of missed issues. When in doubt, split.

## Pull request process

1. Fill out the PR template completely
2. Ensure all CI checks pass
3. Request review from at least one maintainer
4. Address all review comments
5. Squash commits before merge

## Code review checklist

**Author:**
- [ ] Self-reviewed the diff before requesting review
- [ ] PR description explains the "why", not just the "what"
- [ ] Tests added/updated and passing
- [ ] No secrets or credentials in code
- [ ] Breaking changes noted in PR description

**Reviewer:**
- [ ] Code is correct and handles edge cases
- [ ] No obvious performance issues
- [ ] Tests are meaningful (not just coverage padding)
- [ ] Naming is clear and consistent with the codebase
- [ ] Documentation updated if public API changed

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
    category: 'github',
    content: `# Security Policy — {{PROJECT_NAME}}

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ |
| < 1.0   | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a security issue, email: **security@example.com**

You may optionally encrypt your report using our PGP key (key ID: \`0x00000000\`, available on keys.openpgp.org).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within **48 hours**. We will:
1. Confirm receipt of your report
2. Investigate and assess the issue
3. Release a fix or mitigation
4. Credit you in the release notes (unless you prefer anonymity)

## Vulnerability SLAs

| Severity | Fix SLA |
|----------|---------|
| Critical | 48 hours |
| High | 7 days |
| Medium | 30 days |
| Low | 90 days |

Dependabot alerts for **critical** vulnerabilities must be resolved within 48 hours. Run \`npm audit\` in CI on every PR.

## Secrets rotation schedule

| Secret | Rotation | Owner |
|--------|----------|-------|
| JWT signing key | Every 90 days | Platform team |
| Database passwords | Every 180 days | Platform team |
| API keys (third-party) | On staff change | Security team |
| Deploy tokens | Every 90 days | DevOps |

## OWASP Top 10 checklist

- [ ] **A01 Broken Access Control** — Enforce authorization on every endpoint; deny by default
- [ ] **A02 Cryptographic Failures** — Use TLS everywhere; never store plaintext secrets; use bcrypt/argon2 for passwords
- [ ] **A03 Injection** — Use parameterized queries; validate and sanitize all input
- [ ] **A04 Insecure Design** — Threat model new features; use principle of least privilege
- [ ] **A05 Security Misconfiguration** — Harden defaults; disable unused features; set security headers
- [ ] **A06 Vulnerable Components** — Run \`npm audit\` in CI; automate with Dependabot
- [ ] **A07 Auth Failures** — Implement MFA; lock accounts after failed attempts; use secure session management
- [ ] **A08 Software Integrity Failures** — Verify checksums; use lockfiles; pin CI action versions
- [ ] **A09 Logging Failures** — Log auth events, access failures; never log secrets or PII
- [ ] **A10 SSRF** — Validate and allowlist URLs for any server-side requests

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
    category: 'github',
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
    category: 'github',
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
    category: 'github',
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
]
