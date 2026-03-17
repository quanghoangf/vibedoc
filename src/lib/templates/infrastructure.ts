import type { Template } from './types'

export const INFRASTRUCTURE_TEMPLATES: Template[] = [
  {
    id: 'dockerfile',
    name: 'Dockerfile',
    description: 'Multi-stage Docker build with health check',
    defaultPath: 'Dockerfile',
    category: 'infrastructure',
    content: `# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
`,
  },
  {
    id: 'docker-compose',
    name: 'docker-compose.yml',
    description: 'Docker Compose with app, Postgres, and Redis',
    defaultPath: 'docker-compose.yml',
    category: 'infrastructure',
    content: `# Docker Compose V2+ (no version key needed)
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/{{PROJECT_NAME}}
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: {{PROJECT_NAME}}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`,
  },
  {
    id: 'dockerignore',
    name: '.dockerignore',
    description: 'Docker build context exclusions',
    defaultPath: '.dockerignore',
    category: 'infrastructure',
    content: `node_modules
npm-debug.log*
.git
.gitignore
.env*
!.env.example
dist
build
coverage
.nyc_output
*.test.*
*.spec.*
__tests__
e2e
.github
docs
README.md
CHANGELOG.md
`,
  },
  {
    id: 'makefile',
    name: 'Makefile',
    description: 'Makefile with common dev/build/deploy targets',
    defaultPath: 'Makefile',
    category: 'infrastructure',
    content: `.PHONY: help dev build test lint docker-up docker-down migrate clean

help: ## Show this help
\t@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

dev: ## Start development server
\tnpm run dev

build: ## Build for production
\tnpm run build

test: ## Run all tests
\tnpm test

lint: ## Run linter
\tnpm run lint

docker-up: ## Start Docker services
\tdocker compose up -d

docker-down: ## Stop Docker services
\tdocker compose down

migrate: ## Run database migrations
\tnpm run db:migrate

clean: ## Remove build artifacts
\trm -rf dist build .next coverage node_modules/.cache
`,
  },
  {
    id: 'env-example',
    name: '.env.example',
    description: 'Annotated environment variables template',
    defaultPath: '.env.example',
    category: 'infrastructure',
    content: `# App Config
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/{{PROJECT_NAME}}_dev

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-change-in-production

# External Services
# STRIPE_SECRET_KEY=sk_test_...
# SENDGRID_API_KEY=SG....
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=

# Observability
# SENTRY_DSN=https://...@sentry.io/...
# DATADOG_API_KEY=
# NEW_RELIC_LICENSE_KEY=
`,
  },
  {
    id: 'nginx-conf',
    name: 'nginx.conf',
    description: 'Nginx reverse proxy with gzip, security headers, rate limiting',
    defaultPath: 'nginx/nginx.conf',
    category: 'infrastructure',
    content: `events {
  worker_connections 1024;
}

http {
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml;
  gzip_min_length 1000;

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

  server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
      limit_req zone=api burst=20 nodelay;
      proxy_pass http://app:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_cache_bypass $http_upgrade;
    }

    location / {
      proxy_pass http://app:3000;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
`,
  },
]
