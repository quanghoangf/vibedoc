// Install channels, one entry each: the tabs render from this list. A channel with `isPrompt` holds the prompt to paste into an agent (R073);
// one with `downloads` is the desktop app's installers (R112), whose file names are fixed in desktop/electron-builder.yml
// (`artifactName`), so the latest release's links never change.
import { AI_INSTALL_PROMPT } from './ai-install'

export type DesktopOs = 'mac' | 'windows' | 'linux'
export interface Download { os: DesktopOs; label: string; file: string }
export interface InstallChannel { id: string; label: string; command: string; note: string; isPrompt?: boolean; downloads?: Download[] }

export const LATEST_DOWNLOAD = 'https://github.com/quanghoangf/vibedoc/releases/latest/download/'
export const DESKTOP_DOWNLOADS: Download[] = [
  { os: 'mac', label: 'macOS · Apple silicon', file: 'VibeDoc-mac-arm64.dmg' },
  { os: 'mac', label: 'macOS · Intel', file: 'VibeDoc-mac-x64.dmg' },
  { os: 'windows', label: 'Windows', file: 'VibeDoc-Setup.exe' },
  { os: 'linux', label: 'Linux · AppImage', file: 'VibeDoc-x86_64.AppImage' },
]

export const INSTALL: InstallChannel[] = [
  { id: 'npx', label: 'npx', command: 'npx vibedoc', note: 'Runs the latest version in the current project. Nothing to install.' },
  { id: 'npm', label: 'npm', command: 'npm install -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'bun', label: 'bun', command: 'bun add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'brew', label: 'Homebrew', command: 'brew install quanghoangf/vibedoc/vibedoc', note: 'macOS and Linux. Brings its own Node; then run vibedoc in your project.' },
  { id: 'curl', label: 'No Node', command: 'curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh', note: 'macOS and Linux; brings its own Node, asks before touching your PATH and whether to keep VibeDoc running in the background. Windows: irm https://quanghoangf.github.io/vibedoc/install.ps1 | iex' },
  { id: 'desktop', label: 'Desktop (beta)', command: '', downloads: DESKTOP_DOWNLOADS, note: 'Its own window, the same app as the browser, and it updates itself. Not signed yet: the first time, right-click → Open on macOS, More info → Run anyway on Windows.' },
  { id: 'ai', label: 'Ask your AI', command: AI_INSTALL_PROMPT, isPrompt: true, note: 'Paste into Claude Code, Cursor or any agent. It installs, connects and reports what it did.' },
]
