// node src/lib/git-actions.check.mts — blockingChanges, then mergeBranch / openPr on a throwaway repo with a bare
// origin and the fake gh in e2e/fixtures/gh-stub (R108 T564)
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { blockingChanges, mergeBranch, openPr, prCommands } from './git-actions.ts'

// porcelain v1 -z: VibeDoc's files never block, untracked files don't count, a rename counts when a side is outside
assert.deepEqual(blockingChanges(''), [])
assert.deepEqual(blockingChanges(' M plans/tasks/T1-a.md\0 M plans/roadmap/R1.md\0M  memory/MEMORY.md\0 M .vibedoc/settings.json\0 M .vibedoc-activity.json\0'), [])
assert.deepEqual(blockingChanges(' M src/a.ts\0?? scratch.txt\0 D README.md\0'), ['src/a.ts', 'README.md'])
assert.deepEqual(blockingChanges('R  plans/tasks/T2.md\0src/old.ts\0R  plans/tasks/T3.md\0plans/tasks/T3-old.md\0'), ['plans/tasks/T2.md'])
assert.deepEqual(blockingChanges(' M src/with space "q".ts\0'), ['src/with space "q".ts'])
assert.deepEqual(blockingChanges(' M plans/tasksX.md\0 M .vibedocx\0'), ['plans/tasksX.md', '.vibedocx'])

const tmp = mkdtempSync(path.join(tmpdir(), 'vibedoc-git-actions-'))
const root = path.join(tmp, 'repo')
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const status = () => git('status', '--porcelain')
const PATH = process.env.PATH
try {
  mkdirSync(path.join(root, 'plans/tasks'), { recursive: true })
  mkdirSync(path.join(root, 'src'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'check'); git('config', 'user.email', 'check@example.com')
  writeFileSync(path.join(root, 'plans/tasks/T1-a.md'), '# T1: A\n**Status:** todo\n')
  writeFileSync(path.join(root, 'src/app.ts'), 'export const a = 1\n')
  git('add', '-A'); git('commit', '-q', '-m', 'init')
  git('switch', '-q', '-c', 'vibedoc/R1')
  writeFileSync(path.join(root, 'src/feature.ts'), 'export const f = 1\n')
  git('add', '-A'); git('commit', '-q', '-m', 'feat: T1')
  git('switch', '-q', 'main')
  const w = { base: 'main', branch: 'vibedoc/R1' }

  // refused: a dirty src file, another branch checked out, a missing branch
  appendFileSync(path.join(root, 'src/app.ts'), '// mine\n')
  const dirty = await mergeBranch(root, w)
  assert.equal(dirty.ok, false)
  assert.ok(!dirty.ok && dirty.files?.includes('src/app.ts') && /uncommitted/.test(dirty.reason), JSON.stringify(dirty))
  git('checkout', '--', 'src/app.ts')
  git('switch', '-q', '-c', 'other')
  const other = await mergeBranch(root, w)
  assert.ok(!other.ok && /on other, not main/.test(other.reason), JSON.stringify(other))
  git('switch', '-q', 'main'); git('branch', '-q', '-D', 'other')
  assert.ok(!(await mergeBranch(root, { base: 'main', branch: 'nope' })).ok)
  assert.ok(!(await mergeBranch(root, { base: 'main', branch: '--help' })).ok)

  // refused: a conflict is aborted and main's status is as before
  writeFileSync(path.join(root, 'src/feature.ts'), 'export const f = 2\n')
  git('add', '-A'); git('commit', '-q', '-m', 'main: feature')
  appendFileSync(path.join(root, 'plans/tasks/T1-a.md'), 'worker note\n')
  const before = status()
  const conflict = await mergeBranch(root, w)
  assert.ok(!conflict.ok && /conflicts with main in src\/feature\.ts/.test(conflict.reason) && /aborted/.test(conflict.reason), JSON.stringify(conflict))
  assert.equal(status(), before)
  assert.throws(() => git('rev-parse', '-q', '--verify', 'MERGE_HEAD'))
  git('reset', '-q', '--keep', 'HEAD~1')

  // merges while plans/tasks is modified (S6); the task file keeps its change
  const head = git('rev-parse', 'HEAD').trim()
  const merged = await mergeBranch(root, w)
  assert.ok(merged.ok, JSON.stringify(merged))
  assert.equal(git('rev-parse', 'HEAD^1').trim(), head)
  assert.equal(git('log', '-1', '--format=%s').trim(), "Merge branch 'vibedoc/R1'")
  assert.match(status(), /^ M plans\/tasks\/T1-a\.md$/m)

  // git refuses a merge that would overwrite a dirty VibeDoc file: named, nothing changed
  git('switch', '-q', '-c', 'vibedoc/R2')
  writeFileSync(path.join(root, 'plans/tasks/T1-a.md'), '# T1: A\n**Status:** done\n')
  git('commit', '-q', '-am', 'branch edits the task file')
  git('switch', '-q', 'main')
  appendFileSync(path.join(root, 'plans/tasks/T1-a.md'), 'worker note\n')
  const before2 = status()
  const over = await mergeBranch(root, { base: 'main', branch: 'vibedoc/R2' })
  assert.ok(!over.ok && over.files?.includes('plans/tasks/T1-a.md') && /overwrite/.test(over.reason), JSON.stringify(over))
  assert.equal(status(), before2)
  console.log('git-actions merge ok')

  // Open PR: no origin → commands; gh missing → commands, nothing pushed; logged out → commands; stub → URL
  const noOrigin = await openPr(root, w)
  assert.ok(!noOrigin.ok && /no origin/.test(noOrigin.reason))
  assert.deepEqual(!noOrigin.ok && noOrigin.commands, prCommands('main', 'vibedoc/R1'))
  assert.deepEqual(prCommands('main', 'vibedoc/R1'), ['git push -u origin vibedoc/R1', 'gh pr create --fill --base main --head vibedoc/R1'])
  const remote = path.join(tmp, 'origin.git')
  execFileSync('git', ['init', '-q', '--bare', remote])
  git('remote', 'add', 'origin', remote)
  const remoteHas = (b: string) => execFileSync('git', ['ls-remote', '--heads', remote, b], { encoding: 'utf8' }).trim() !== ''

  const onlyGit = path.join(tmp, 'only-git')
  mkdirSync(onlyGit)
  symlinkSync(execFileSync('which', ['git'], { encoding: 'utf8' }).trim(), path.join(onlyGit, 'git'))
  process.env.PATH = onlyGit
  const noGh = await openPr(root, w)
  assert.ok(!noGh.ok && /not installed/.test(noGh.reason) && noGh.commands?.length === 2, JSON.stringify(noGh))
  assert.equal(remoteHas('vibedoc/R1'), false)

  process.env.PATH = `${path.resolve(import.meta.dirname, '../../e2e/fixtures/gh-stub')}${path.delimiter}${PATH}`
  writeFileSync(path.join(root, '.gh-stub-logged-out'), '')
  const loggedOut = await openPr(root, w)
  assert.ok(!loggedOut.ok && /gh auth login/.test(loggedOut.reason) && loggedOut.commands?.length === 2, JSON.stringify(loggedOut))
  assert.equal(remoteHas('vibedoc/R1'), false)
  rmSync(path.join(root, '.gh-stub-logged-out'))

  const pr = await openPr(root, w)
  assert.deepEqual(pr, { ok: true, url: 'https://github.com/example/fixture/pull/1' })
  assert.equal(remoteHas('vibedoc/R1'), true)
  assert.equal(git('config', 'branch.vibedoc/R1.remote').trim(), 'origin')
  assert.deepEqual(await openPr(root, w), pr, 'an existing PR counts as opened')
  // the run card's default base HEAD = the branch checked out now
  assert.deepEqual(await openPr(root, { base: 'HEAD', branch: 'vibedoc/R1' }), pr)
  git('switch', '-q', '--detach')
  assert.ok(!(await openPr(root, { base: 'HEAD', branch: 'vibedoc/R1' })).ok)
  assert.ok(!(await mergeBranch(root, { base: 'HEAD', branch: 'vibedoc/R1' })).ok)
  git('switch', '-q', 'main')
  console.log('git-actions pr ok')
} finally {
  process.env.PATH = PATH
  rmSync(tmp, { recursive: true, force: true })
}
