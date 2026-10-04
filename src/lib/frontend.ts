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
  /** Monorepo: every web app package, best first, so the UI can offer the rest (T139) */
  candidates?: FrontendCandidate[]
  /** T143: path Log in opens, e.g. "/login" (settings only, never detected) */
  loginPath?: string
}

export type FrontendCandidate = { dir: string; name: string; framework: Framework }

/** `.vibedoc/settings.json` `frontend`: each set field wins over detection (T139). */
export type FrontendOverride = { dir?: string; startCommand?: string; url?: string; loginPath?: string }

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
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {}
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
  const port = URL.canParse(app.url) ? new URL(app.url).port : ''
  if (port === String(vibedocPort)) {
    notes.push(`Port ${vibedocPort} is VibeDoc’s own port: start the app on another port, or run VibeDoc with a different PORT.`)
  }
  return notes
}

// ─── Monorepos + override (T139) ─────────────────────────────────────────────

/**
 * Workspace globs from package.json `workspaces` (array or `{packages}`) and pnpm-workspace.yaml `packages:`.
 * Negations (`!x`) are dropped; core.ts expands what is left.
 */
export function workspacePatterns(packageJson: string | null, pnpmWorkspaceYaml: string | null): string[] {
  const out: string[] = []
  try {
    const ws = packageJson ? JSON.parse(packageJson)?.workspaces : null
    const list = Array.isArray(ws) ? ws : Array.isArray(ws?.packages) ? ws.packages : []
    out.push(...list.filter((p: unknown): p is string => typeof p === 'string'))
  } catch {}
  if (pnpmWorkspaceYaml) {
    // ponytail: line parser for the block list under `packages:`; flow style `[a, b]` isn't read
    let inPackages = false
    for (const line of pnpmWorkspaceYaml.split('\n')) {
      if (/^packages:\s*(#.*)?$/.test(line)) { inPackages = true; continue }
      if (!inPackages) continue
      const item = line.match(/^\s+-\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/)
      if (item) out.push(item[1])
      else if (/^\S/.test(line)) inPackages = false
    }
  }
  return [...new Set(out.map(p => p.trim().replace(/\/+$/, '')).filter(p => p && !p.startsWith('!')))]
}

const WEB_NAMES = new Set(['web', 'frontend', 'client', 'app', 'www', 'site'])

/** Higher = more likely the app to test: dev script, apps/ folder, a web-ish name; Storybook/docs packages sink. */
export function packageScore(dir: string, packageJson: string): number {
  let pkg: { name?: unknown; dependencies?: object; devDependencies?: object; scripts?: Record<string, unknown> }
  try { pkg = JSON.parse(packageJson) ?? {} } catch { return 0 }
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {}
  const name = typeof pkg.name === 'string' ? pkg.name.replace(/^@[^/]+\//, '') : ''
  const base = dir.split('/').pop() ?? ''
  let score = 0
  if (typeof scripts.dev === 'string') score += 2
  if (dir.startsWith('apps/')) score += 1
  if (WEB_NAMES.has(name) || WEB_NAMES.has(base)) score += 1
  if (deps.some(d => d === 'storybook' || d.startsWith('@storybook/')) || /\b(docs|storybook)\b/.test(`${name} ${base}`)) score -= 3
  return score
}

/** Run a workspace package's script from the root with the package manager's filter. */
export function workspaceStartCommand(pm: PackageManager, dir: string, name: string, script: string): string {
  switch (pm) {
    case 'pnpm': return `pnpm --filter ${name} ${script}`
    case 'yarn': return `yarn workspace ${name} ${script}`
    case 'bun': return `bun run --filter ${name} ${script}`
    default: return `npm run ${script} -w ${dir}`
  }
}

/**
 * The app to test: the best-scoring workspace package with a web framework, else the root package.
 * `packages` = each expanded workspace dir with its package.json; root lockfiles decide the package manager.
 */
export function detectFrontendProject(
  rootPackageJson: string | null, rootFiles: string[], packages: { dir: string; packageJson: string }[],
): FrontendApp | null {
  const apps = packages
    .map(p => ({ app: detectFrontendApp(p.dir, p.packageJson, rootFiles), score: packageScore(p.dir, p.packageJson) }))
    .filter((x): x is { app: FrontendApp; score: number } => x.app != null)
    .sort((a, b) => b.score - a.score || a.app.dir.localeCompare(b.app.dir))
  if (apps.length === 0) return detectFrontendApp('.', rootPackageJson, rootFiles)
  const best = apps[0].app
  return {
    ...best,
    // detectFrontendApp built "<pm> run <script>" for the package's own dir; run it from the root instead
    startCommand: workspaceStartCommand(best.packageManager, best.dir, best.name, best.startCommand.split(' ').pop() ?? 'dev'),
    candidates: apps.map(({ app }) => ({ dir: app.dir, name: app.name, framework: app.framework })),
  }
}

/** Keeps only non-empty string fields; null when nothing is left (= no override). */
export function cleanOverride(raw: unknown): FrontendOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const out: FrontendOverride = {}
  for (const key of ['dir', 'startCommand', 'url', 'loginPath'] as const) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
  }
  return Object.keys(out).length ? out : null
}

/**
 * Override fields win. `dir` alone switches to that candidate with its detected start command and URL,
 * so `detectAt(dir)` is the detection for another candidate (core passes it). Unknown dirs keep the rest as typed.
 */
export function applyOverride(
  detected: FrontendApp | null, override: FrontendOverride | null, detectAt: (dir: string) => FrontendApp | null,
): FrontendApp | null {
  if (!override) return detected
  // loginPath alone doesn't change which app this is, nor make it an override
  if (!override.dir && !override.startCommand && !override.url) {
    return detected && override.loginPath ? { ...detected, loginPath: override.loginPath } : detected
  }
  const base = override.dir && override.dir !== detected?.dir ? detectAt(override.dir) : detected
  const fallback: FrontendApp = {
    dir: override.dir ?? '.', name: override.dir ?? '.', framework: 'unknown',
    packageManager: detected?.packageManager ?? 'npm', startCommand: '', url: '', source: 'override',
  }
  return {
    ...(base ?? fallback),
    ...override,
    source: 'override',
    ...(detected?.candidates && { candidates: detected.candidates }),
  }
}

// ─── Playwright (T141) ───────────────────────────────────────────────────────

/** Resolved from the target app's node_modules (app dir, then root), never VibeDoc's. */
export type PlaywrightStatus = { installed: boolean; version?: string; browsersInstalled?: boolean }

export const PLAYWRIGHT_PACKAGES = ['@playwright/test', 'playwright'] as const

/** Installed = a node_modules package.json for @playwright/test or playwright was found; its version wins. */
export function playwrightStatus(nodeModulesPackageJsons: (string | null)[], browsersInstalled: boolean): PlaywrightStatus {
  for (const raw of nodeModulesPackageJsons) {
    if (raw == null) continue
    let version: unknown
    try { version = JSON.parse(raw)?.version } catch { continue }
    return { installed: true, ...(typeof version === 'string' && { version }), browsersInstalled }
  }
  return { installed: false, browsersInstalled }
}

/** A Playwright browser cache listing (`chromium-1140`, `chromium_headless_shell-1140`, …) has Chromium. */
export function hasChromium(cacheEntries: string[]): boolean {
  // ponytail: any Chromium revision counts; matching the revision to the installed Playwright version is a later refinement
  return cacheEntries.some(e => /^chromium(_headless_shell)?-\d+$/.test(e))
}

const ADD_DEV: Record<PackageManager, string[]> = {
  npm: ['npm', 'install', '-D'], pnpm: ['pnpm', 'add', '-D'], yarn: ['yarn', 'add', '-D'], bun: ['bun', 'add', '-d'],
}

/**
 * Argv steps run in the app dir, in order; empty when nothing is missing.
 * No package → add @playwright/test, then Chromium; package but no Chromium → Chromium only.
 */
export function playwrightInstallSteps(pm: PackageManager, status: PlaywrightStatus): string[][] {
  const browsers = ['npx', 'playwright', 'install', 'chromium']
  if (!status.installed) return [[...ADD_DEV[pm], '@playwright/test'], browsers]
  return status.browsersInstalled === false ? [browsers] : []
}

export const formatSteps = (steps: string[][]) => steps.map(s => s.join(' ')).join(' && ')

// ─── MCP text (T140) ─────────────────────────────────────────────────────────

/** `vibedoc_get_status` line, e.g. `Frontend: apps/web (vite) · pnpm --filter web dev · http://localhost:5173`. */
export function frontendStatusLine(app: FrontendApp | null): string {
  if (!app) return 'Frontend: none detected'
  return `Frontend: ${[`${app.dir} (${app.framework})`, app.startCommand, app.url].filter(Boolean).join(' · ')}`
}

function playwrightLine(app: FrontendApp, pw: PlaywrightStatus | null | undefined): string {
  if (!pw) return 'unknown'
  const steps = playwrightInstallSteps(app.packageManager, pw)
  const state = pw.installed ? `installed${pw.version ? ` v${pw.version}` : ''}${pw.browsersInstalled === false ? ', Chromium missing' : ''}` : 'not installed'
  return steps.length ? `${state} (run in ${app.dir}: \`${formatSteps(steps)}\`)` : state
}

// ─── Login session (T143) ────────────────────────────────────────────────────

/** Playwright storageState saved by Log in, at `.vibedoc/auth/storage-state.json`; savedAt = its mtime (ISO). */
export type FrontendAuth = { saved: boolean; savedAt?: string }

/** The URL Log in opens: the app URL plus the optional login path. Null when the app URL isn't a full URL. */
export function loginUrl(app: FrontendApp): string | null {
  if (!URL.canParse(app.url)) return null
  return new URL(app.loginPath ?? '', app.url).toString()
}

/** Why Log in can't open a headed browser here, or null when it can. */
export function loginUnavailable(env: { demo: boolean; platform: string; display?: string; waylandDisplay?: string }): string | null {
  if (env.demo) return 'Not available in the read-only demo.'
  if (env.platform === 'linux' && !env.display && !env.waylandDisplay) return 'No desktop session (DISPLAY is not set): Log in needs to open a browser window.'
  return null
}

function authLine(auth: FrontendAuth | null | undefined): string {
  if (!auth) return 'unknown'
  return auth.saved
    ? `session saved${auth.savedAt ? ` ${auth.savedAt}` : ''} (.vibedoc/auth/storage-state.json, Playwright storageState)`
    : 'no saved session (Settings → Frontend app → Log in)'
}

/** `vibedoc_get_frontend` reply. */
export function formatFrontend(app: FrontendApp | null, notes: string[], playwright?: PlaywrightStatus | null, auth?: FrontendAuth | null): string {
  if (!app) {
    return [
      '## Frontend app',
      'No web frontend detected: no package.json in the project root or its workspace packages depends on Next, Vite, Remix, Astro, Nuxt, SvelteKit or Create React App.',
      'If the app is there but not recognised, set it in Settings → Frontend app (dir, start command, URL); it is saved as `frontend` in .vibedoc/settings.json.',
    ].join('\n')
  }
  const others = (app.candidates ?? []).filter(c => c.dir !== app.dir)
  return [
    '## Frontend app',
    `**Dir:** ${app.dir}${app.name !== app.dir ? ` (${app.name})` : ''}`,
    `**Framework:** ${app.framework}`,
    `**Start command:** ${app.startCommand || 'unknown'}`,
    `**URL:** ${app.url || 'unknown'}`,
    `**Source:** ${app.source === 'override' ? 'override (Settings → Frontend app)' : 'detected'}`,
    `**Playwright:** ${playwrightLine(app, playwright)}`,
    ...(app.loginPath ? [`**Login path:** ${app.loginPath}`] : []),
    `**Auth:** ${authLine(auth)}`,
    ...(others.length ? [`**Other apps:** ${others.map(c => `${c.dir} (${c.framework})`).join(', ')}`] : []),
    ...notes.map(n => `⚠ ${n}`),
  ].join('\n')
}
