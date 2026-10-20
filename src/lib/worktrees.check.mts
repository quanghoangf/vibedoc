// Self-check: agent worktree paths and `git worktree list --porcelain` parsing. Run: node src/lib/worktrees.check.mts
import assert from 'node:assert/strict'
import path from 'node:path'
import { branchSlug, defaultBranch, ownWorktrees, parseWorktreeList, projectSlug, worktreeDir } from './worktrees.ts'

// Slugs: `/`, spaces, case
assert.equal(branchSlug('vibedoc/R108'), 'vibedoc-r108')
assert.equal(branchSlug('Feature/My Branch'), 'feature-my-branch')
assert.equal(branchSlug('  fix//Two  Slashes '), 'fix-two-slashes')
assert.equal(branchSlug('/// '), 'branch')
assert.equal(defaultBranch('R108'), 'vibedoc/R108')
assert.equal(defaultBranch(' T560 '), 'vibedoc/T560')

// Project slug: basename + hash of the absolute root
assert.match(projectSlug('/work/My App'), /^my-app-[0-9a-f]{8}$/)
assert.notEqual(projectSlug('/a/app'), projectSlug('/b/app'), 'two repos named app get their own folder')
assert.equal(projectSlug('/a/app/'), projectSlug('/a/app'))

const home = '/home/u/.vibedoc'
assert.equal(worktreeDir(home, 'app-1234abcd', 'vibedoc/R108'), path.join(home, 'worktrees', 'app-1234abcd', 'vibedoc-r108'))

// Porcelain: main, ours on a branch, detached, locked with a reason, bare
const porcelain = [
  'worktree /work/app', 'HEAD 1111111111111111111111111111111111111111', 'branch refs/heads/main', '',
  `worktree ${home}/worktrees/app-1234abcd/vibedoc-r108`, 'HEAD 2222222222222222222222222222222222222222', 'branch refs/heads/vibedoc/R108', '',
  `worktree ${home}/worktrees/app-1234abcd/detached`, 'HEAD 3333333333333333333333333333333333333333', 'detached', '',
  `worktree ${home}/worktrees/app-1234abcd/locked one`, 'HEAD 4444444444444444444444444444444444444444', 'branch refs/heads/x', 'locked on a usb disk', '',
  'worktree /work/bare.git', 'bare', '',
].join('\n')
const list = parseWorktreeList(porcelain)
assert.equal(list.length, 5)
assert.deepEqual(list[0], { path: '/work/app', head: '1'.repeat(40), branch: 'main', detached: false, locked: false, bare: false })
assert.equal(list[1].branch, 'vibedoc/R108')
assert.equal(list[2].detached, true)
assert.equal(list[2].branch, null)
assert.equal(list[3].locked, true)
assert.equal(list[3].path, `${home}/worktrees/app-1234abcd/locked one`, 'spaces in a path are kept')
assert.equal(list[4].bare, true)
assert.deepEqual(parseWorktreeList(''), [])
assert.equal(parseWorktreeList('worktree /a\r\nHEAD abc\r\n\r\nworktree /b\r\ndetached\r\n').length, 2, 'CRLF')

// Ours = under <home>/worktrees/ only (either spelling of home)
assert.deepEqual(ownWorktrees(list, home).map(w => w.branch ?? 'detached'), ['vibedoc/R108', 'detached', 'x'])
assert.equal(ownWorktrees(list, ['/private/home', home]).length, 3)
assert.equal(ownWorktrees([{ ...list[0], path: `${home}/worktrees-other/x` }], home).length, 0, 'prefix is a folder, not a string')

console.log('worktrees: ok')
