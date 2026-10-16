/**
 * src/lib/folder-picker.ts
 * The OS folder picker for All projects → Add project: VibeDoc's server runs on the user's machine, so it opens the
 * native dialog (Finder on macOS) and hands the chosen absolute path back; a browser can't give a folder's path.
 * Process only (no fs). One picker at a time; its child lives on globalThis like git-clone's.
 */
import { execFile } from 'child_process'

const PICK_TIMEOUT_MS = 10 * 60_000

/** argv per platform, or null when there is no picker (the UI falls back to typing the path). Pure, for the check. */
export function pickerCommand(platform: string, prompt: string): { cmd: string; args: string[] } | null {
  if (platform === 'darwin') {
    // `path to frontmost application` puts the dialog in front of the browser instead of behind it
    const script = `tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`
    return { cmd: 'osascript', args: ['-e', script] }
  }
  if (platform === 'win32') {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = ${JSON.stringify(prompt)}; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`
    return { cmd: 'powershell', args: ['-NoProfile', '-STA', '-Command', ps] }
  }
  if (platform === 'linux') return { cmd: 'zenity', args: ['--file-selection', '--directory', `--title=${prompt}`] }
  return null
}

export type PickResult = { path: string } | { cancelled: true } | { unsupported: true } | { busy: true }

const g = globalThis as unknown as { vibedocPicking?: boolean }

/** The chosen folder's absolute path; cancel (exit 1, no output) and a missing picker binary are not errors. */
export function pickFolder(prompt: string, platform = process.platform): Promise<PickResult> {
  const command = pickerCommand(platform, prompt)
  if (!command) return Promise.resolve({ unsupported: true })
  if (g.vibedocPicking) return Promise.resolve({ busy: true })
  g.vibedocPicking = true
  return new Promise(resolve => {
    execFile(command.cmd, command.args, { timeout: PICK_TIMEOUT_MS }, (err, stdout) => {
      g.vibedocPicking = false
      const path = stdout.trim().replace(/(.)\/$/, '$1') // osascript ends a folder with "/"
      if (path) return resolve({ path })
      // ENOENT: no osascript/zenity/powershell on this machine → let the user type it
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return resolve({ unsupported: true })
      resolve({ cancelled: true })
    })
  })
}
