import type { Template } from './types'

export const GITHUB_ACTIONS_TEMPLATES: Template[] = [
  {
    id: 'ci-workflow',
    name: 'CI Workflow',
    description: 'GitHub Actions CI: lint, typecheck, test matrix, coverage',
    defaultPath: '.github/workflows/ci.yml',
    category: 'github-actions',
    content: `name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '20', cache: 'npm'}
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20', '22']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '\${{ matrix.node-version }}', cache: 'npm'}
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        if: matrix.node-version == '20'

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '20', cache: 'npm'}
      - run: npm ci
      - run: npm run build
`,
  },
  {
    id: 'cd-workflow',
    name: 'CD Workflow',
    description: 'GitHub Actions CD: deploy to production with health check',
    defaultPath: '.github/workflows/cd.yml',
    category: 'github-actions',
    content: `name: CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    # needs: [ci]  # Uncomment if using a reusable CI workflow
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '20', cache: 'npm'}
      - run: npm ci
      - run: npm run build
      - name: Deploy
        env:
          DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
          DEPLOY_URL: \${{ secrets.DEPLOY_URL }}
        run: |
          # Add your deployment command here
          # e.g.: npx railway deploy, vercel deploy --prod, etc.
          echo "Deploy to production"
      - name: Health check
        run: |
          sleep 30
          curl -f \${{ secrets.APP_URL }}/health || exit 1
`,
  },
  {
    id: 'security-scan',
    name: 'Security Scan',
    description: 'GitHub Actions security: npm audit + CodeQL analysis',
    defaultPath: '.github/workflows/security.yml',
    category: 'github-actions',
    content: `name: Security
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '20', cache: 'npm'}
      - run: npm ci
      - run: npm audit --audit-level=high

  codeql:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: {languages: javascript}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
`,
  },
  {
    id: 'dependabot-config',
    name: 'Dependabot Config',
    description: 'Dependabot config: npm + GitHub Actions weekly updates',
    defaultPath: '.github/dependabot.yml',
    category: 'github-actions',
    content: `version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
      day: monday
`,
  },
  {
    id: 'release-workflow',
    name: 'Release Workflow',
    description: 'GitHub Actions release: GitHub Release + Docker image to GHCR',
    defaultPath: '.github/workflows/release.yml',
    category: 'github-actions',
    content: `name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/\${{ github.repository }}:\${{ github.ref_name }}
            ghcr.io/\${{ github.repository }}:latest
`,
  },
  {
    id: 'codeowners',
    name: 'CODEOWNERS',
    description: 'GitHub CODEOWNERS file for review assignments',
    defaultPath: '.github/CODEOWNERS',
    category: 'github',
    content: `# IMPORTANT: Replace {{PROJECT_NAME}} below with your GitHub organization name
# (org name and project name are often different)
# Format: @org-name/team-slug

# Global owners - review all changes
* @{{PROJECT_NAME}}/maintainers

# Documentation
docs/ @{{PROJECT_NAME}}/docs
*.md @{{PROJECT_NAME}}/docs

# CI/CD config
.github/ @{{PROJECT_NAME}}/devops
Dockerfile @{{PROJECT_NAME}}/devops
docker-compose*.yml @{{PROJECT_NAME}}/devops

# Security-sensitive files
**/auth/ @{{PROJECT_NAME}}/security
**/security/ @{{PROJECT_NAME}}/security
SECURITY.md @{{PROJECT_NAME}}/security
`,
  },
]
