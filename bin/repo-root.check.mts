// Self-check for the repo walk (R100). Run: node bin/repo-root.check.mts
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { repoRoot } from './repo-root.mjs'

const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), 'vibedoc-repo-root-')))
try {
  const repo = path.join(tmp, 'mono')
  const pkg = path.join(repo, 'packages', 'web')
  mkdirSync(path.join(repo, '.git'), { recursive: true })
  mkdirSync(pkg, { recursive: true })
  writeFileSync(path.join(pkg, 'package.json'), '{}')
  assert.equal(repoRoot(pkg), repo, 'a package folder → the monorepo root, not the package.json folder')
  assert.equal(repoRoot(repo), repo, 'the root itself')

  const worktree = path.join(tmp, 'wt')
  mkdirSync(path.join(worktree, 'src'), { recursive: true })
  writeFileSync(path.join(worktree, '.git'), 'gitdir: /elsewhere\n')
  assert.equal(repoRoot(path.join(worktree, 'src')), worktree, '.git as a file (worktree) counts')

  const loose = path.join(tmp, 'loose')
  mkdirSync(loose)
  // tmpdir has no .git above it on a normal machine; skip the null case if it does
  if (repoRoot(tmp) === null) assert.equal(repoRoot(loose), null, 'no .git up to / → null')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log('repo-root.check: ok')
