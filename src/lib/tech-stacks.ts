export interface TechCategory {
  id: string
  label: string
  techs: string[]
}

export const TECH_CATEGORIES: TechCategory[] = [
  {
    id: "language",
    label: "Language",
    techs: ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#", "Ruby", "Kotlin", "Swift", "PHP", "Elixir"],
  },
  {
    id: "frontend",
    label: "Frontend",
    techs: ["React", "Vue", "Angular", "Next.js", "Nuxt", "SvelteKit", "Remix", "Astro", "Vite", "Tailwind CSS", "React Native", "Expo"],
  },
  {
    id: "backend",
    label: "Backend",
    techs: ["Node.js", "Express", "Fastify", "NestJS", "FastAPI", "Django", "Flask", "Rails", "Spring Boot", "Go/Fiber", "Rust/Actix", "Hono", "Bun"],
  },
  {
    id: "database",
    label: "Database",
    techs: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Supabase", "PlanetScale", "DynamoDB", "Cassandra", "Prisma", "Drizzle", "TypeORM"],
  },
  {
    id: "devops",
    label: "DevOps",
    techs: ["Docker", "Kubernetes", "GitHub Actions", "GitLab CI", "CircleCI", "Jenkins", "Terraform", "Pulumi", "AWS", "GCP", "Azure", "Vercel", "Railway", "Fly.io", "Render"],
  },
  {
    id: "testing",
    label: "Testing",
    techs: ["Jest", "Vitest", "Playwright", "Cypress", "Testing Library", "pytest", "RSpec", "Mocha", "k6"],
  },
  {
    id: "tools",
    label: "Tools",
    techs: ["ESLint", "Prettier", "Husky", "lint-staged", "Storybook", "Turborepo", "pnpm", "Nx", "GraphQL", "tRPC", "Zod", "Stripe"],
  },
]

export const ALL_TECHS: string[] = TECH_CATEGORIES.flatMap(c => c.techs)

export interface TechPreset {
  id: string
  label: string
  techs: string[]
}

export const TECH_PRESETS: TechPreset[] = [
  { id: "nextjs",       label: "Next.js Full-Stack", techs: ["TypeScript", "Next.js", "React", "Tailwind CSS", "PostgreSQL", "Prisma"] },
  { id: "python-api",   label: "Python API",         techs: ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"] },
  { id: "react-native", label: "React Native",       techs: ["TypeScript", "React Native", "Expo"] },
  { id: "go-service",   label: "Go Microservice",    techs: ["Go", "Go/Fiber", "PostgreSQL", "Docker", "Kubernetes"] },
  { id: "sveltekit",    label: "SvelteKit",          techs: ["TypeScript", "SvelteKit", "Tailwind CSS", "SQLite"] },
]
