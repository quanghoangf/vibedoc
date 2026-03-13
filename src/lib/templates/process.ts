import type { Template } from './types'

export const PROCESS_TEMPLATES: Template[] = [
  {
    id: 'changelog',
    name: 'CHANGELOG.md',
    description: 'Keep a Changelog format',
    defaultPath: 'CHANGELOG.md',
    category: 'process',
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
    category: 'process',
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
    category: 'process',
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
    category: 'process',
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
]
