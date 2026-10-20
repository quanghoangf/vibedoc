// Start at login (R110 T573): `vibedoc login on|off|status`. One login item per OS, which runs
// `<launcher> start --no-open` (R109's background start) when the user logs in:
//   macOS   ~/Library/LaunchAgents/io.github.quanghoangf.vibedoc.plist (RunAtLoad, no KeepAlive: start returns at once)
//   Linux   systemd user unit ~/.config/systemd/user/vibedoc.service, else XDG autostart ~/.config/autostart/vibedoc.desktop
//   Windows the `VibeDoc` value under HKCU\Software\Microsoft\Windows\CurrentVersion\Run (reg.exe, no admin)
// `off` only removes the item: a VibeDoc running now keeps running. Nothing else in the VibeDoc home is touched.
// Plain JS: the bin ships unbuilt. Platform, home folder, VibeDoc home, launcher and the command runner are injectable.
// Check: node bin/login.check.mts
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LAUNCH_AGENT_LABEL = 'io.github.quanghoangf.vibedoc'
export const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
export const RUN_VALUE = 'VibeDoc'
/** What the login item runs after the launcher: background start, no browser tab at login. */
export const LOGIN_ARGS = ['start', '--no-open']

const binScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vibedoc.mjs')

/** spawnSync without a shell; a missing program is status null. */
function defaultRun(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true })
  return { status: r.error ? null : r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function options(opts = {}) {
  const platform = opts.platform ?? process.platform
  const home = opts.home ?? os.homedir()
  const vibedocHome = opts.vibedocHome ?? process.env.VIBEDOC_HOME ?? path.join(home, '.vibedoc')
  return { platform, home, vibedocHome, run: opts.run ?? defaultRun, uid: opts.uid ?? process.getuid?.() ?? 0, launcher: opts.launcher }
}

/**
 * The absolute command that starts this VibeDoc (never a bare `vibedoc`: PATH isn't set up at login). From the
 * one-line installer that is its launcher `<vibedoc home>/bin/vibedoc[.cmd]` (it puts its own Node first on PATH);
 * from anywhere else (npm global, a checkout) this Node + this bin script.
 */
export function launcherCommand({ platform = process.platform, vibedocHome, script = binScript, execPath = process.execPath, exists = existsSync } = {}) {
  const launcher = path.join(vibedocHome, 'bin', platform === 'win32' ? 'vibedoc.cmd' : 'vibedoc')
  const fromInstaller = vibedocHome && path.resolve(script).startsWith(path.resolve(vibedocHome, 'lib') + path.sep)
  return fromInstaller && exists(launcher) ? [launcher] : [execPath, script]
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** systemd / XDG Exec quoting: every word in double quotes, `\` `"` `$` escaped (`%` doubled for systemd specifiers). */
const quoteExec = (words, { systemd = false } = {}) => words.map((w) => `"${w.replace(/[\\"$]/g, (c) => `\\${c}`).replace(/%/g, systemd ? '%%' : '%')}"`).join(' ')
/** A Run value: the program quoted, the arguments plain. */
const quoteWin = ([cmd, ...rest]) => [`"${cmd}"`, ...rest].join(' ')

export function plist(command) {
  const args = command.map((a) => `    <string>${xmlEscape(a)}</string>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <!-- the supervisor outlives \`start\`: launchd must not kill it when the job exits -->
  <key>AbandonProcessGroup</key>
  <true/>
</dict>
</plist>
`
}

export function systemdUnit(command, launcher) {
  return `# Written by \`vibedoc login on\`; remove with \`vibedoc login off\`
[Unit]
Description=VibeDoc (background)

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${quoteExec(command, { systemd: true })}
ExecStop=${quoteExec([...launcher, 'stop'], { systemd: true })}

[Install]
WantedBy=default.target
`
}

export function desktopEntry(command) {
  return `[Desktop Entry]
Type=Application
Name=VibeDoc
Comment=Start VibeDoc in the background (written by \`vibedoc login on\`)
Exec=${quoteExec(command)}
Terminal=false
X-GNOME-Autostart-enabled=true
`
}

const paths = ({ home }) => ({
  plist: path.join(home, 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`),
  unit: path.join(home, '.config', 'systemd', 'user', 'vibedoc.service'),
  desktop: path.join(home, '.config', 'autostart', 'vibedoc.desktop'),
})

function writeFile(file, text) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

/**
 * Turns start at login on (idempotent: one item, rewritten with the current launcher). Returns
 * {ok, mechanism, where} or {ok: false, error}.
 */
export function loginOn(opts) {
  const o = options(opts)
  const launcher = o.launcher ?? launcherCommand(o)
  const command = [...launcher, ...LOGIN_ARGS]
  const p = paths(o)
  if (o.platform === 'darwin') {
    writeFile(p.plist, plist(command))
    return { ok: true, mechanism: 'LaunchAgent', where: p.plist }
  }
  if (o.platform === 'win32') {
    const r = o.run('reg', ['add', RUN_KEY, '/v', RUN_VALUE, '/t', 'REG_SZ', '/d', quoteWin(command), '/f'])
    if (r.status !== 0) return { ok: false, error: `reg add failed: ${(r.stderr || r.stdout).trim() || `exit ${r.status}`}` }
    return { ok: true, mechanism: 'Run key', where: `${RUN_KEY}\\${RUN_VALUE}` }
  }
  // Linux and other Unixes: systemd user unit, else XDG autostart
  writeFile(p.unit, systemdUnit(command, launcher))
  const reload = o.run('systemctl', ['--user', 'daemon-reload'])
  const enable = reload.status === 0 ? o.run('systemctl', ['--user', 'enable', 'vibedoc.service']) : reload
  if (enable.status === 0) {
    rmSync(p.desktop, { force: true }) // one item only: an earlier fallback goes
    return { ok: true, mechanism: 'systemd user unit', where: p.unit }
  }
  rmSync(p.unit, { force: true })
  writeFile(p.desktop, desktopEntry(command))
  return { ok: true, mechanism: 'XDG autostart', where: p.desktop }
}

/** Removes the login item (all mechanisms of this OS). Never stops a running VibeDoc. Returns {ok, removed: [...]}. */
export function loginOff(opts) {
  const o = options(opts)
  const p = paths(o)
  const removed = []
  if (o.platform === 'darwin') {
    if (existsSync(p.plist)) {
      // best effort: unloads the job; its supervisor runs in its own process group and keeps going
      o.run('launchctl', ['bootout', `gui/${o.uid}/${LAUNCH_AGENT_LABEL}`])
      rmSync(p.plist, { force: true })
      removed.push(p.plist)
    }
    return { ok: true, removed }
  }
  if (o.platform === 'win32') {
    if (o.run('reg', ['query', RUN_KEY, '/v', RUN_VALUE]).status === 0) {
      const r = o.run('reg', ['delete', RUN_KEY, '/v', RUN_VALUE, '/f'])
      if (r.status !== 0) return { ok: false, error: `reg delete failed: ${(r.stderr || r.stdout).trim() || `exit ${r.status}`}`, removed }
      removed.push(`${RUN_KEY}\\${RUN_VALUE}`)
    }
    return { ok: true, removed }
  }
  if (existsSync(p.unit)) {
    // disable, never stop: stop would run ExecStop (`vibedoc stop`)
    o.run('systemctl', ['--user', 'disable', 'vibedoc.service'])
    rmSync(p.unit, { force: true })
    o.run('systemctl', ['--user', 'daemon-reload'])
    removed.push(p.unit)
  }
  if (existsSync(p.desktop)) {
    rmSync(p.desktop, { force: true })
    removed.push(p.desktop)
  }
  return { ok: true, removed }
}

/** {on: false} or {on: true, mechanism, where, command}: command = the line the item runs. */
export function loginStatus(opts) {
  const o = options(opts)
  const p = paths(o)
  if (o.platform === 'darwin') {
    if (!existsSync(p.plist)) return { on: false }
    const args = [...readFileSync(p.plist, 'utf8').matchAll(/<string>([^<]*)<\/string>/g)].slice(1).map((m) => m[1])
    return { on: true, mechanism: 'LaunchAgent', where: p.plist, command: args.join(' ') }
  }
  if (o.platform === 'win32') {
    const r = o.run('reg', ['query', RUN_KEY, '/v', RUN_VALUE])
    if (r.status !== 0) return { on: false }
    const value = r.stdout.match(/REG_SZ\s+(.*)$/m)?.[1]?.trim() ?? ''
    return { on: true, mechanism: 'Run key', where: `${RUN_KEY}\\${RUN_VALUE}`, command: value }
  }
  for (const [file, mechanism, key] of [[p.unit, 'systemd user unit', 'ExecStart'], [p.desktop, 'XDG autostart', 'Exec']]) {
    if (!existsSync(file)) continue
    const command = readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? ''
    return { on: true, mechanism, where: file, command }
  }
  return { on: false }
}

export const formatLoginStatus = (s) => (s.on ? `Start at login: on (${s.mechanism}, ${s.where})` : 'Start at login: off')

export const LOGIN_USAGE = 'usage: vibedoc login on|off|status'

/** `vibedoc login <action>`: prints and returns the exit code (0 ok, 1 bad action or failure). */
export function runLogin(args, opts) {
  const action = args[0]
  if (action === 'status') {
    console.log(formatLoginStatus(loginStatus(opts)))
    return 0
  }
  if (action === 'on') {
    const r = loginOn(opts)
    if (!r.ok) {
      console.error(`✗ Couldn't turn on start at login: ${r.error}`)
      return 1
    }
    console.log(`✓ Start at login: on (${r.mechanism}, ${r.where})`)
    console.log('   VibeDoc starts in the background when you log in. Run `vibedoc start` to start it now.')
    return 0
  }
  if (action === 'off') {
    const r = loginOff(opts)
    if (!r.ok) {
      console.error(`✗ Couldn't turn off start at login: ${r.error}`)
      return 1
    }
    console.log(r.removed.length ? '✓ Start at login: off' : 'Start at login was already off')
    console.log('   A VibeDoc running now keeps running until `vibedoc stop` or you log out. Your projects and data are untouched.')
    return 0
  }
  console.error(LOGIN_USAGE)
  return 1
}
