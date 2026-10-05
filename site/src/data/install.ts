// Install channels, one entry each: the tabs render from this list. A channel with `isPrompt` holds the prompt to paste into an agent (R073).
import { AI_INSTALL_PROMPT } from './ai-install'

export interface InstallChannel { id: string; label: string; command: string; note: string; isPrompt?: boolean }

export const INSTALL: InstallChannel[] = [
  { id: 'npx', label: 'npx', command: 'npx vibedoc', note: 'Runs the latest version in the current project. Nothing to install.' },
  { id: 'npm', label: 'npm', command: 'npm install -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'bun', label: 'bun', command: 'bun add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'brew', label: 'Homebrew', command: 'brew install quanghoangf/vibedoc/vibedoc', note: 'macOS and Linux. Brings its own Node; then run vibedoc in your project.' },
  { id: 'curl', label: 'No Node', command: 'curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh', note: 'macOS and Linux; brings its own Node and asks before touching your PATH. Windows: irm https://quanghoangf.github.io/vibedoc/install.ps1 | iex' },
  { id: 'ai', label: 'Ask your AI', command: AI_INSTALL_PROMPT, isPrompt: true, note: 'Paste into Claude Code, Cursor or any agent. It installs, connects and reports what it did.' },
]
