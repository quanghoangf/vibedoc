// Self-check for start at login (R110 T573). Run: node bin/login.check.mts
// Every OS runs here: a temp HOME and a fake command runner stand in for launchctl / systemctl / reg.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LAUNCH_AGENT_LABEL, RUN_KEY, launcherCommand, loginOff, loginOn, loginStatus, formatLoginStatus } from './login.mjs'

type Call = [string, string[]]
const fakeRun = (status: (cmd: string, args: string[]) => number = () => 0) => {
  const calls: Call[] = []
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, args])
    return { status: status(cmd, args), stdout: '', stderr: '' }
  }
  return { calls, run }
}
const tmp = () => mkdtempSync(path.join(tmpdir(), 'vibedoc-login-'))
const launcher = ['/Users/a b/.vibedoc/bin/vibedoc']

/** All files under dir, relative. */
const tree = (dir: string): string[] => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile()).map((d) => path.relative(dir, path.join(d.parentPath, d.name))).sort()

// launcherCommand: the installer's launcher only for the installer's own copy, else this Node + the bin script
{
  const vh = '/h/.vibedoc'
  const exists = () => true
  assert.deepEqual(launcherCommand({ platform: 'darwin', vibedocHome: vh, script: `${vh}/lib/lib/node_modules/vibedoc/bin/vibedoc.mjs`, exists }), [`${vh}/bin/vibedoc`])
  assert.deepEqual(launcherCommand({ platform: 'darwin', vibedocHome: vh, script: '/repo/bin/vibedoc.mjs', execPath: '/usr/bin/node', exists }), ['/usr/bin/node', '/repo/bin/vibedoc.mjs'])
  assert.deepEqual(launcherCommand({ platform: 'darwin', vibedocHome: vh, script: `${vh}/lib/x/bin/vibedoc.mjs`, execPath: '/n', exists: () => false }), ['/n', `${vh}/lib/x/bin/vibedoc.mjs`], 'no launcher file → node + script')
}

// macOS: plist with the absolute launcher + start --no-open; on twice → one item; off removes only the plist
{
  const home = tmp()
  const vibedocHome = path.join(home, '.vibedoc')
  mkdirSync(path.join(vibedocHome, 'logs'), { recursive: true })
  writeFileSync(path.join(vibedocHome, 'server.json'), '{}')
  writeFileSync(path.join(vibedocHome, 'hub.json'), '{}')
  const project = path.join(home, 'work', 'app')
  mkdirSync(project, { recursive: true })
  writeFileSync(path.join(project, 'README.md'), '# app')
  const { calls, run } = fakeRun()
  const o = { platform: 'darwin', home, vibedocHome, run, launcher, uid: 501 }
  try {
    assert.deepEqual(loginStatus(o), { on: false })
    const before = tree(home)
    const r = loginOn(o)
    assert.equal(r.ok, true)
    const file = path.join(home, 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`)
    assert.equal(r.where, file)
    const xml = readFileSync(file, 'utf8')
    assert.match(xml, /<string>\/Users\/a b\/\.vibedoc\/bin\/vibedoc<\/string>\s*<string>start<\/string>\s*<string>--no-open<\/string>/)
    assert.match(xml, /<key>RunAtLoad<\/key>\s*<true\/>/)
    assert.match(xml, /<key>KeepAlive<\/key>\s*<false\/>/)
    loginOn({ ...o, launcher: ['/new/vibedoc'] })
    assert.deepEqual(readdirSync(path.dirname(file)), [`${LAUNCH_AGENT_LABEL}.plist`], 'on twice → one item')
    assert.match(readFileSync(file, 'utf8'), /<string>\/new\/vibedoc<\/string>/, 'launcher path rewritten')
    const s = loginStatus(o)
    assert.equal(s.on, true)
    assert.equal(s.command, '/new/vibedoc start --no-open')
    assert.equal(formatLoginStatus(s), `Start at login: on (LaunchAgent, ${file})`)
    assert.equal(calls.length, 0, 'on never loads the job (it runs at the next login)')

    const off = loginOff(o)
    assert.deepEqual(off.removed, [file])
    assert.deepEqual(calls, [['launchctl', ['bootout', `gui/501/${LAUNCH_AGENT_LABEL}`]]])
    assert.deepEqual(loginStatus(o), { on: false })
    assert.equal(formatLoginStatus(loginStatus(o)), 'Start at login: off')
    // S4: everything else is as before (the empty LaunchAgents folder aside)
    assert.deepEqual(tree(home), before)
    assert.deepEqual(loginOff(o).removed, [], 'off again is a no-op')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

// Linux with systemd: unit written + enabled; off disables (never stops) and removes it
{
  const home = tmp()
  const { calls, run } = fakeRun()
  const o = { platform: 'linux', home, vibedocHome: path.join(home, '.vibedoc'), run, launcher }
  try {
    const r = loginOn(o)
    const unit = path.join(home, '.config', 'systemd', 'user', 'vibedoc.service')
    assert.deepEqual([r.mechanism, r.where], ['systemd user unit', unit])
    const text = readFileSync(unit, 'utf8')
    assert.match(text, /^Type=oneshot$/m)
    assert.match(text, /^RemainAfterExit=yes$/m)
    assert.match(text, /^ExecStart="\/Users\/a b\/\.vibedoc\/bin\/vibedoc" "start" "--no-open"$/m)
    assert.match(text, /^ExecStop="\/Users\/a b\/\.vibedoc\/bin\/vibedoc" "stop"$/m)
    assert.match(text, /^WantedBy=default\.target$/m)
    assert.deepEqual(calls, [['systemctl', ['--user', 'daemon-reload']], ['systemctl', ['--user', 'enable', 'vibedoc.service']]])
    loginOn(o)
    assert.deepEqual(readdirSync(path.dirname(unit)), ['vibedoc.service'])
    assert.equal(loginStatus(o).mechanism, 'systemd user unit')
    calls.length = 0
    assert.deepEqual(loginOff(o).removed, [unit])
    assert.ok(!calls.some(([, a]) => a.includes('stop')), 'off never runs systemctl stop')
    assert.deepEqual(calls[0], ['systemctl', ['--user', 'disable', 'vibedoc.service']])
    assert.ok(!existsSync(unit))
    assert.deepEqual(loginStatus(o), { on: false })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

// Linux without systemd: the XDG autostart file instead, and no unit left behind
{
  const home = tmp()
  const { run } = fakeRun((cmd) => (cmd === 'systemctl' ? 1 : 0))
  const o = { platform: 'linux', home, vibedocHome: path.join(home, '.vibedoc'), run, launcher }
  try {
    const r = loginOn(o)
    const desktop = path.join(home, '.config', 'autostart', 'vibedoc.desktop')
    assert.deepEqual([r.mechanism, r.where], ['XDG autostart', desktop])
    assert.match(readFileSync(desktop, 'utf8'), /^Exec="\/Users\/a b\/\.vibedoc\/bin\/vibedoc" "start" "--no-open"$/m)
    assert.ok(!existsSync(path.join(home, '.config', 'systemd', 'user', 'vibedoc.service')))
    loginOn(o)
    assert.deepEqual(readdirSync(path.dirname(desktop)), ['vibedoc.desktop'])
    assert.equal(loginStatus(o).mechanism, 'XDG autostart')
    assert.deepEqual(loginOff(o).removed, [desktop])
    assert.deepEqual(loginStatus(o), { on: false })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

// Windows: the Run value set, read and removed through reg
{
  const home = tmp()
  let value: string | null = null
  const calls: Call[] = []
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, args])
    if (args[0] === 'add') value = args[args.indexOf('/d') + 1]
    if (args[0] === 'delete') value = null
    if (args[0] === 'query') return value == null ? { status: 1, stdout: '', stderr: 'not found' } : { status: 0, stdout: `\r\n${RUN_KEY}\r\n    VibeDoc    REG_SZ    ${value}\r\n`, stderr: '' }
    return { status: 0, stdout: '', stderr: '' }
  }
  const o = { platform: 'win32', home, vibedocHome: path.join(home, '.vibedoc'), run, launcher: ['C:\\Users\\a b\\.vibedoc\\bin\\vibedoc.cmd'] }
  try {
    assert.deepEqual(loginStatus(o), { on: false })
    const r = loginOn(o)
    assert.equal(r.ok, true)
    assert.deepEqual(calls.find(([, a]) => a[0] === 'add'), ['reg', ['add', RUN_KEY, '/v', 'VibeDoc', '/t', 'REG_SZ', '/d', '"C:\\Users\\a b\\.vibedoc\\bin\\vibedoc.cmd" start --no-open', '/f']])
    loginOn(o)
    const s = loginStatus(o)
    assert.equal(s.on, true)
    assert.equal(s.command, '"C:\\Users\\a b\\.vibedoc\\bin\\vibedoc.cmd" start --no-open')
    assert.deepEqual(loginOff(o).removed, [`${RUN_KEY}\\VibeDoc`])
    assert.deepEqual(loginStatus(o), { on: false })
    assert.deepEqual(readdirSync(home), [], 'nothing written to disk on Windows')
    // a failing reg add is reported
    const bad = loginOn({ ...o, run: () => ({ status: 1, stdout: '', stderr: 'Access is denied.' }) })
    assert.deepEqual(bad, { ok: false, error: 'reg add failed: Access is denied.' })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

console.log('login.check: ok')
