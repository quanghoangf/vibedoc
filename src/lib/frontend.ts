// Frontend app detection (R057), pure: core.ts reads package.json + lockfiles and passes them in.
// Self-check: node src/lib/frontend.check.mts

export type Framework = 'next' | 'vite' | 'remix' | 'astro' | 'nuxt' | 'sveltekit' | 'cra' | 'unknown'
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type FrontendApp = {
  dir: string            // relative to VIBEDOC_ROOT, "." for root
  name: string           // package.json name
  framework: Framework
  packageManager: PackageManager
  startCommand: string   // e.g. "pnpm run dev"
  url: string            // e.g. "http://localhost:5173"
  source: 'detected' | 'override'
}

/** Lockfile → package manager, in priority order. core.ts checks which of these exist. */
export const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
]

const DEFAULT_PORTS: Record<Framework, number> = {
  next: 3000, nuxt: 3000, cra: 3000, remix: 3000, vite: 5173, sveltekit: 5173, astro: 4321, unknown: 3000,
}

/** Most specific first: Remix / SvelteKit / Nuxt / Astro apps also depend on vite. */
function frameworkOf(deps: Record<string, unknown>): Framework {
  const has = (n: string) => n in deps
  if (Object.keys(deps).some(n => n.startsWith('@remix-run/'))) return 'remix'
  if (has('@sveltejs/kit')) return 'sveltekit'
  if (has('nuxt')) return 'nuxt'
  if (has('astro')) return 'astro'
  if (has('next')) return 'next'
  if (has('react-scripts')) return 'cra'
  if (has('vite')) return 'vite'
  return 'unknown'
}

/** `--port 4000`, `--port=4000`, `-p 4000`, `-p=4000` in a script; null when absent. */
export function portFromScript(script: string): number | null {
  const m = script.match(/(?:^|\s)(?:--port|-p)(?:=|\s+)(\d{2,5})\b/)
  return m ? Number(m[1]) : null
}

/** Null when there is no package.json, it doesn't parse, or no known web framework is in its dependencies. */
export function detectFrontendApp(dir: string, packageJson: string | null, lockfiles: string[]): FrontendApp | null {
  if (packageJson == null) return null
  let pkg: { name?: unknown; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown>; scripts?: Record<string, unknown> }
  try { pkg = JSON.parse(packageJson) } catch { return null }
  if (!pkg || typeof pkg !== 'object') return null
  const framework = frameworkOf({ ...pkg.dependencies, ...pkg.devDependencies })
  if (framework === 'unknown') return null
  const packageManager = LOCKFILES.find(([file]) => lockfiles.includes(file))?.[1] ?? 'npm'
  const scripts = pkg.scripts ?? {}
  const scriptName = typeof scripts.dev === 'string' ? 'dev' : typeof scripts.start === 'string' ? 'start' : 'dev'
  const script = typeof scripts[scriptName] === 'string' ? scripts[scriptName] as string : ''
  const port = portFromScript(script) ?? DEFAULT_PORTS[framework]
  return {
    dir,
    name: typeof pkg.name === 'string' && pkg.name ? pkg.name : dir,
    framework,
    packageManager,
    startCommand: `${packageManager} run ${scriptName}`,
    url: `http://localhost:${port}`,
    source: 'detected',
  }
}

/** Warnings shown next to the app on Settings: it is VibeDoc itself, or it wants VibeDoc's port. */
export function frontendNotes(app: FrontendApp, vibedocPort: number, isVibedocRepo: boolean): string[] {
  const notes: string[] = []
  if (isVibedocRepo) notes.push('This is VibeDoc’s own repo.')
  if (new URL(app.url).port === String(vibedocPort)) {
    notes.push(`Port ${vibedocPort} is VibeDoc’s own port: start the app on another port, or run VibeDoc with a different PORT.`)
  }
  return notes
}
