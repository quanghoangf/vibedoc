<p align="center">
  <a href="https://quanghoangf.github.io/vibedoc/"><img src="site/public/og.png" alt="VibeDoc: every task your agent finishes comes with proof" width="820"></a>
</p>

<p align="center">
  <b>Spec-driven development for AI coding agents.</b><br>
  Your plan, specs and memory live as markdown in your repo. Claude Code, Cursor or any MCP agent works them task by task,<br>
  and you review each task on its tests, screenshots and video.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vibedoc"><img src="https://img.shields.io/npm/v/vibedoc?color=7c6af7&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/vibedoc"><img src="https://img.shields.io/npm/dm/vibedoc?color=7c6af7" alt="npm downloads"></a>
  <a href="https://github.com/quanghoangf/vibedoc/actions/workflows/ci.yml"><img src="https://github.com/quanghoangf/vibedoc/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/quanghoangf/vibedoc?color=7c6af7" alt="MIT license"></a>
  <a href="https://github.com/quanghoangf/vibedoc/stargazers"><img src="https://img.shields.io/github/stars/quanghoangf/vibedoc?style=flat&color=7c6af7" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="https://quanghoangf.github.io/vibedoc/"><b>Website</b></a> ·
  <a href="https://quanghoangf.github.io/vibedoc/docs/"><b>Docs</b></a> ·
  <a href="https://quanghoangf.github.io/vibedoc/docs/tools/"><b>MCP tools</b></a> ·
  <a href="https://quanghoangf.github.io/vibedoc/changelog/"><b>Changelog</b></a>
</p>

<p align="center">
  <img src="site/public/screens/board.jpg" alt="The VibeDoc board: tasks moving through Todo, In progress, Review and Done while an agent works" width="900">
</p>

## Why VibeDoc

AI agents write code fast, then forget. The next session rebuilds context from scratch, "done" is the agent's word for it, and the docs drift until nobody trusts them. VibeDoc gives the agent a home in your repo and gives you the proof:

- **A plan the agent can follow.** Horizons, epics and tasks are markdown files. The agent claims the next ready task, respecting dependencies, and the board moves live in your browser.
- **Proof, not promises.** Each finished task carries a test checklist, a Playwright run with a screenshot per step and a video, and a verdict. Steps that prove nothing are flagged.
- **Specs that stay current.** Capability specs with WHEN/THEN scenarios. Agents see the related requirements when they claim a task, and each epic's spec changes are merged in one reviewed diff.
- **Memory between sessions.** A session handoff plus one-fact knowledge entries, recalled when they matter.

Everything is plain files in your repo. No database, no cloud, no account.

## Quick start

```bash
cd your-project
npx vibedoc
```

VibeDoc opens in your browser and prints its MCP URL and the command to connect Claude Code. A project keeps the same address on every run, so you connect once. In the app, **Settings → Connect agent** runs both steps below for you after you confirm, and ticks each one when it sees it working (Cursor and others get the config to paste). By hand (Claude Code shown; [Cursor, Windsurf and others](https://quanghoangf.github.io/vibedoc/docs/#2-connect-your-agent)):

```bash
claude mcp add --transport http vibedoc http://localhost:3333/api/mcp   # use the URL VibeDoc printed
```

Then add the skills in Claude Code and plan your first epic:

```text
/plugin marketplace add quanghoangf/vibedoc
/plugin install vibedoc@vibedoc
/vibedoc:roadmap
```

On a new project the welcome screen also suggests popular Claude Code plugins that fit it (**Pick your toolkit**) and installs the ones you tick after one confirm.

**Rather not read?** Paste [the install prompt](https://quanghoangf.github.io/vibedoc/docs/ai-install/) into your agent: it starts VibeDoc, connects it, adds the skills and reports back.

### Try the demo first

```bash
npx vibedoc --demo
```

Opens a sample project (a roadmap in progress, tasks in every status, agent chats, a test run with its evidence video, memory and a doc graph) in a throwaway copy. Change anything; nothing touches your files, and the copy is deleted when you stop it. The demo runs no agents: "Use VibeDoc on my project" in its header gives you the command for your own repo.

### Install it

`npx vibedoc` needs nothing installed. To keep a `vibedoc` command:

| Channel | Install | Update | Uninstall |
|---------|---------|--------|-----------|
| npm | `npm install -g vibedoc` | `npm install -g vibedoc@latest` | `npm uninstall -g vibedoc` |
| pnpm | `pnpm add -g vibedoc` | `pnpm add -g vibedoc@latest` | `pnpm remove -g vibedoc` |
| bun | `bun add -g vibedoc` | `bun add -g vibedoc@latest` | `bun remove -g vibedoc` |
| Homebrew (macOS, Linux) | `brew install quanghoangf/vibedoc/vibedoc` | `brew upgrade vibedoc` | `brew uninstall vibedoc` |
| No Node (macOS, Linux) | `curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh \| sh` | same with `sh -s -- --update` | same with `sh -s -- --uninstall` |
| No Node (Windows) | `irm https://quanghoangf.github.io/vibedoc/install.ps1 \| iex` | run it again | [see the docs](https://quanghoangf.github.io/vibedoc/docs/) |

Every channel serves the same version. Check with `vibedoc --version`. Needs Node.js 20.9+ (Homebrew, the one-line installer and the desktop app bring their own).

### Keep it running

`vibedoc` runs in the foreground: closing the terminal stops it. To keep VibeDoc up without a terminal:

```bash
vibedoc start        # in the background; prints the address and gives the terminal back
vibedoc status       # running or not, where, since when, the log file
vibedoc stop         # stops it and everything it started (agent runs, test runs)
vibedoc login on     # also start it in the background every time you log in (off: vibedoc login off)
```

A crashed background VibeDoc restarts itself on the same address, so your agents stay connected. The one-line installer asks once whether to turn on start at login (`VIBEDOC_BACKGROUND=1` or `=0` answers for scripts). More: [Run in the background](https://quanghoangf.github.io/vibedoc/docs/#run-in-the-background).

### Desktop app

VibeDoc in its own window, with a Dock / taskbar icon and the same screens as the browser. It uses the VibeDoc that already runs (from any install) or starts its own, and it updates itself after one click.

| macOS | Windows | Linux |
|---|---|---|
| [Apple silicon](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-mac-arm64.dmg) · [Intel](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-mac-x64.dmg) | [VibeDoc-Setup.exe](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-Setup.exe) | [AppImage](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-x86_64.AppImage) |

The builds aren't signed yet: the first time, right-click → **Open** on macOS, **More info → Run anyway** on Windows. See [Desktop app](https://quanghoangf.github.io/vibedoc/docs/desktop-app/).

## How it works

Four commands, one loop. They ship as a Claude Code plugin; in Cursor or any MCP client the same steps are the `vibedoc_*` tools.

| Step | Command | What happens |
|---|---|---|
| **Plan** | `/vibedoc:roadmap` | Reads your docs, interviews you about users and goals, writes horizons and epics with scenarios. |
| **Break down** | `/vibedoc:breakdown R004` | Splits an epic into tasks an agent can pick up cold: scope, files, acceptance criteria, verify commands. |
| **Build and prove** | `/vibedoc:work R004` | Claims the next ready task, builds it, runs its checks and a Playwright spec, commits, and repeats. |
| **Review** | `/vibedoc:next` | You approve on the evidence or send findings back; `next` tells you the most useful thing to do now. |

```
your browser  →  http://localhost:<port>          board, roadmap, docs, test review, memory
your agent    →  http://localhost:<port>/api/mcp  52 MCP tools, same files, same live state
```

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="site/public/screens/roadmap.jpg" alt="Roadmap map with horizons and epics"><br>
      <b>Roadmap</b><br>Horizons and epics on a map or a timeline, with progress, due dates and drift (overdue, at risk, uncovered scenarios) worked out from the files.
    </td>
    <td width="50%" valign="top">
      <img src="site/public/screens/evidence.jpg" alt="Evidence view of a task's test run"><br>
      <b>Evidence</b><br>Each checklist item next to the step that proved it: screenshot, video, verdict, history. Re-run any task, or the whole regression suite, from the browser.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="site/public/screens/spec.jpg" alt="A capability spec open in Docs"><br>
      <b>Capability specs</b><br>One spec per capability with WHEN/THEN scenarios. Agents get the related requirements on claim; a verifying agent checks the diff against them.
    </td>
    <td width="50%" valign="top">
      <img src="site/public/screens/memory.jpg" alt="Memory browser with knowledge entries"><br>
      <b>Memory</b><br>The session handoff and one-fact entries (conventions, gotchas, decisions), with search, history and import from Claude Code's own memory.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="site/public/screens/epic.jpg" alt="An epic sheet with scenarios and tasks"><br>
      <b>Scenarios as acceptance tests</b><br>An epic's promise as numbered scenarios. Every task says which ones it covers, and the epic shows each as passed, failed or unproven.
    </td>
    <td width="50%" valign="top">
      <img src="site/public/screens/graph.jpg" alt="The doc link graph"><br>
      <b>Link graph</b><br>Docs, tasks, epics, specs and entries joined by the links in their text. Broken and stale links stand out.
    </td>
  </tr>
</table>

Also: **Work with agent** on a task or an epic, which runs a coding agent task by task in its own git worktree and branch while the board follows it ([Agent runs](https://quanghoangf.github.io/vibedoc/docs/concepts/agent-runs/)); a [desktop app](https://quanghoangf.github.io/vibedoc/docs/desktop-app/); an agent chat inside the app that plans with you and proposes edits as diffs, live activity and session history, saved board views, a docs editor with live collaboration, and an API reference from your `openapi.yaml` (endpoints and schemas in Docs, Try it against your local app, `vibedoc_get_endpoint` for the agent).

## Recommended CLAUDE.md snippet

The skills do this for you in Claude Code. For other agents, add this to the project's `CLAUDE.md` / `AGENTS.md`:

```markdown
## Session protocol
- Start: `vibedoc_read_memory` (last session's handoff), then `vibedoc_get_status`.
- Work an epic: `vibedoc_next_task { epic: "R004" }` claims the next ready task with its full spec; build it, run its Verify block,
  then `vibedoc_update_task <id> done` with a manual test checklist. Repeat until the epic is finished or needs a human.
- Decisions: `vibedoc_log_decision` writes an ADR. Lasting facts: `vibedoc_save_entry`.
- End: `vibedoc_update_memory` with the handoff for the next session.
```

Every tool, with its parameters: [MCP tool reference](https://quanghoangf.github.io/vibedoc/docs/tools/).

## Your files

VibeDoc reads the folder you start it in and shows what it finds. Nothing is required up front.

```
your-project/
├── plans/roadmap/R004-billing.md   horizons and epics (scenarios, spec changes)
├── plans/tasks/T031-checkout.md     one task per file: status, deps, spec, checklist
├── docs/specs/billing.md            capability specs
├── docs/**/*.md                     your docs, ADRs in docs/architecture/decisions/
└── memory/MEMORY.md, entries/       session handoff and knowledge entries
```

VibeDoc's own state stays small and readable: `.vibedoc-activity.json` (the activity log) and `.vibedoc/` (settings, saved views, chats). Outside the repo, in `~/.vibedoc/` (or `$VIBEDOC_HOME`): test runs (`runs/`), the projects hub and its port (`hub.json`, `port`), background mode's state and log (`server.json`, `logs/`), and agent worktrees (`worktrees/`).

VibeDoc sends nothing about your project. On a first run it asks once whether to send anonymous first-run steps (off unless you say yes); see [First-run feedback & privacy](https://quanghoangf.github.io/vibedoc/docs/privacy/).

## Development

```bash
git clone https://github.com/quanghoangf/vibedoc.git
cd vibedoc
pnpm install
VIBEDOC_ROOT=/path/to/a/project pnpm dev
```

Next.js 16 (App Router) · Tailwind CSS 4 · MCP over HTTP JSON-RPC (`/api/mcp`) · Server-Sent Events · the file system as the only store. The landing page and docs are in [`site/`](site/) (Astro + Starlight); the desktop app is in [`desktop/`](desktop/) (Electron, its own package: `pnpm build && pnpm --dir desktop install && pnpm --dir desktop start`, see [docs/desktop-app.md](docs/desktop-app.md)).

Pull requests are welcome: see [CONTRIBUTING.md](./CONTRIBUTING.md) for the architecture rules and commit conventions, and open an [issue](https://github.com/quanghoangf/vibedoc/issues/new/choose) for bugs and ideas.

## License

[MIT](./LICENSE)
