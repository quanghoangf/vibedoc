/**
 * src/lib/git-actions.ts (R108 T564)
 * The finish panel's Open PR and Merge: the user's actions, run by the server in the main checkout with a fixed argv
 * and no shell. Process only (no fs). A worker never runs these: its argv denies `git push` (ADR-007).
 */
import { execFile } from 'child_process'

/** A push or `gh` call that hangs (network, a prompt) is cut off after this. */
const TIMEOUT_MS = 60_000

/** VibeDoc's own files: workers' MCP calls keep them uncommitted in the main checkout, so they never block a merge. */
const VIBEDOC_DIRS = ['plans/tasks/', 'plans/roadmap/', 'memory/', '.vibedoc/']
const VIBEDOC_FILES = ['.vibedoc-activity.json']

export const isVibedocOwned = (p: string) => VIBEDOC_FILES.includes(p) || VIBEDOC_DIRS.some(d => p.startsWith(d))

/**
 * Paths with uncommitted changes outside VibeDoc's own files, from `git status --porcelain=v1 -z`. Untracked files
 * don't count: a merge never loses one (git refuses to overwrite it). A rename counts when either side is outside.
 */
export function blockingChanges(status: string): string[] {
  const out: string[] = []
  const parts = status.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i]
    if (e.length < 4) continue
    const xy = e.slice(0, 2)
    // -z: a rename or copy is followed by its original path
    const paths = /[RC]/.test(xy) ? [e.slice(3), parts[++i] ?? ''] : [e.slice(3)]
    if (xy === '??' || xy === '!!') continue
    if (paths.some(p => !isVibedocOwned(p))) out.push(paths[0])
  }
  return out
}

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  /** the program is not on PATH */
  missing: boolean
}

function run(cmd: 'git' | 'gh', args: string[], cwd: string): Promise<RunResult> {
  // never wait on a credential or confirm prompt nobody can answer
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' }
  return new Promise(resolve => {
    execFile(cmd, args, { cwd, timeout: TIMEOUT_MS, env }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean }) | null
      const timedOut = e?.killed ? `${cmd} ${args.join(' ')} timed out after ${TIMEOUT_MS / 1000}s\n` : ''
      resolve({ ok: !e, stdout: String(stdout ?? ''), stderr: (timedOut + String(stderr ?? '')).trim() || (e?.message ?? ''), missing: e?.code === 'ENOENT' })
    })
  })
}

const git = (args: string[], cwd: string) => run('git', args, cwd)
const firstLine = (s: string) => s.split('\n').find(l => l.trim())?.trim() ?? ''
const badRef = (r: string) => !r || r.startsWith('-')

export const pushArgs = (branch: string) => ['push', '-u', 'origin', branch]
export const prArgs = (base: string, branch: string) => ['pr', 'create', '--fill', '--base', base, '--head', branch]
export const mergeArgs = (branch: string) => ['merge', '--no-ff', '--no-edit', branch]
/** What the user runs themselves when `gh` can't (missing, logged out); also what the confirm dialog names. */
export const prCommands = (base: string, branch: string) => [`git ${pushArgs(branch).join(' ')}`, `gh ${prArgs(base, branch).join(' ')}`]

/**
 * The run card's default base is the literal `HEAD` (run-proposal.ts): that means the branch the main checkout has out
 * now. Null on a detached HEAD.
 */
// ponytail: resolved when the user acts, so a checkout switched since the run merges/opens the PR against the new branch; store the branch at create if that bites
async function resolveBase(root: string, base: string): Promise<{ base: string | null; current: string }> {
  const current = (await git(['branch', '--show-current'], root)).stdout.trim()
  return { base: base === 'HEAD' ? current || null : base, current }
}

export type MergeResult = { ok: true; sha: string } | { ok: false; reason: string; files?: string[] }

/**
 * `git merge --no-ff <branch>` into `base`, in the main checkout. Refused unless `base` is checked out and nothing
 * outside VibeDoc's files is uncommitted. A conflict is aborted, never resolved: the checkout is left as it was.
 */
export async function mergeBranch(root: string, { base, branch }: { base: string; branch: string }): Promise<MergeResult> {
  if (badRef(base) || badRef(branch)) return { ok: false, reason: 'A branch and a base are required' }
  const resolved = await resolveBase(root, base)
  const current = resolved.current
  if (!resolved.base) return { ok: false, reason: 'The main checkout is on a detached HEAD. Switch it to a branch, or open a PR.' }
  base = resolved.base
  if (current !== base) return { ok: false, reason: `The main checkout is on ${current || 'a detached HEAD'}, not ${base}. Switch it to ${base}, or open a PR.` }
  if (!(await git(['rev-parse', '-q', '--verify', `refs/heads/${branch}`], root)).ok) return { ok: false, reason: `Branch ${branch} doesn't exist any more.` }
  const status = await git(['status', '--porcelain=v1', '-z', '--untracked-files=no'], root)
  if (!status.ok) return { ok: false, reason: `git status failed: ${firstLine(status.stderr)}` }
  const blocking = blockingChanges(status.stdout)
  if (blocking.length) return { ok: false, reason: `The main checkout has uncommitted changes outside VibeDoc's files: ${blocking.join(', ')}. Commit or stash them, or open a PR.`, files: blocking }

  const merged = await git(mergeArgs(branch), root)
  if (merged.ok) return { ok: true, sha: (await git(['rev-parse', 'HEAD'], root)).stdout.trim() }
  if ((await git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], root)).ok) {
    const files = (await git(['diff', '--name-only', '--diff-filter=U'], root)).stdout.split('\n').filter(Boolean)
    const abort = await git(['merge', '--abort'], root)
    if (!abort.ok) console.warn(`git merge --abort in ${root}: ${firstLine(abort.stderr)}`)
    return files.length
      ? { ok: false, reason: `${branch} conflicts with ${base} in ${files.join(', ')}. The merge was aborted: open a PR to resolve it.`, files }
      : { ok: false, reason: `git merge failed and was aborted: ${firstLine(merged.stderr || merged.stdout)}` }
  }
  // refused before it started, e.g. it would overwrite a file with uncommitted changes (listed tab-indented)
  const files = merged.stderr.split('\n').filter(l => l.startsWith('\t')).map(l => l.trim())
  return { ok: false, reason: `git refused the merge${files.length ? `: it would overwrite ${files.join(', ')}` : `: ${firstLine(merged.stderr || merged.stdout)}`}. Open a PR instead.`, ...(files.length && { files }) }
}

export type PrResult = { ok: true; url: string } | { ok: false; reason: string; commands?: string[] }

const lastUrl = (s: string) => s.match(/https?:\/\/\S+/g)?.pop()

/**
 * `git push -u origin <branch>`, then `gh pr create --fill`. Without `gh` or its login nothing is pushed and the
 * result carries the two commands for the user to run. A PR that already exists for the branch counts as opened.
 */
export async function openPr(root: string, { base, branch }: { base: string; branch: string }): Promise<PrResult> {
  if (badRef(base) || badRef(branch)) return { ok: false, reason: 'A branch and a base are required' }
  const resolved = (await resolveBase(root, base)).base
  if (!resolved) return { ok: false, reason: 'The main checkout is on a detached HEAD, so the PR has no base branch. Switch it to a branch first.' }
  base = resolved
  const commands = prCommands(base, branch)
  if (!(await git(['remote', 'get-url', 'origin'], root)).ok) return { ok: false, reason: 'The repo has no origin remote. Add one, then run these:', commands }
  const auth = await run('gh', ['auth', 'status'], root)
  if (auth.missing) return { ok: false, reason: 'The GitHub CLI (gh) is not installed. Run these yourself:', commands }
  if (!auth.ok) return { ok: false, reason: 'The GitHub CLI is not logged in (gh auth login). Run these yourself:', commands }
  const push = await git(pushArgs(branch), root)
  if (!push.ok) return { ok: false, reason: `git push failed: ${firstLine(push.stderr)}` }
  const pr = await run('gh', prArgs(base, branch), root)
  const url = pr.ok ? lastUrl(pr.stdout) : /already exists/.test(pr.stderr) ? lastUrl(pr.stderr) : undefined
  if (url) return { ok: true, url }
  return { ok: false, reason: `gh pr create failed: ${firstLine(pr.stderr || pr.stdout)}`, commands: commands.slice(1) }
}
