// Install channels, one entry each: the tabs render from this list. R072 (Homebrew) and R073 (ask your AI) add theirs here.
export interface InstallChannel { id: string; label: string; command: string; note: string }

export const INSTALL: InstallChannel[] = [
  { id: 'npx', label: 'npx', command: 'npx vibedoc', note: 'Runs the latest version in the current project. Nothing to install.' },
  { id: 'npm', label: 'npm', command: 'npm install -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
  { id: 'bun', label: 'bun', command: 'bun add -g vibedoc', note: 'Installs the vibedoc command; then run vibedoc in your project.' },
]
