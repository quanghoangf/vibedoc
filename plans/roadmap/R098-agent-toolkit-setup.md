# R098: Agent toolkit setup
**Parent:** R002
**Status:** in-progress
**Order:** 390
**Tasks:** T524, T525, T526, T527, T528

A new user sets up the popular Claude Code plugins and skills that fit their project during onboarding, without hunting for marketplace commands. Today VibeDoc connects only itself (R081), and the rest of the agent's toolkit is left to the README and word of mouth.

**In scope:** a short vetted catalog of Claude Code plugins/skills shipped with VibeDoc, each with a one-line reason; items that fit the project (from its docs and files) ranked first; a checkbox step on the first-run welcome after Connect your agent; the in-app agent can run the same interview in chat and install the picks; one confirm for everything picked; a live ✓ or the real error per item, with a copy-the-command fallback; items already installed show as installed
**Out of scope:** MCP servers, CLI tools, starter agent rules, browsing or searching a marketplace, removing plugins, a Settings page for the toolkit
**Done when:** on a fresh project, a user picks 3 plugins on the welcome, confirms once, and sees 3 ✓ without leaving VibeDoc

<!-- vibedoc:steps -->
- **Connect your agent** — VibeDoc's MCP server and skills (R081)
- **Pick your toolkit** — suggested plugins, best fit first
- **Confirm once** — one dialog lists everything that will be installed
- **See proof** — each plugin turns ✓, or shows the error and the command

## Catalog
Vetted v1 list. Verify names and install commands against the live marketplaces before shipping. **Fit signal** is what ranks an item first (S1).

| Item | Source | Reason (one line shown to the user) | Fit signal |
|---|---|---|---|
| frontend-design | claude-plugins-official | UI work that avoids the generic "AI look" | web frontend detected (R057) |
| webapp-testing | anthropics/skills | Agent checks your running web app in a real browser | web frontend detected |
| code-review | claude-plugins-official | `/code-review`: parallel reviewers, only confident findings | git repo |
| commit-commands | claude-plugins-official | `/commit`, `/commit-push-pr`, branch cleanup | git repo |
| feature-dev | claude-plugins-official | Guided explore → design → build → review workflow | any codebase |
| security-guidance | claude-plugins-official | Warns about risky edits (injection, eval, secrets) as they happen | server code / API routes |
| superpowers | obra/superpowers | Skills for TDD, systematic debugging, verify-before-done | any codebase |
| LSP plugin (typescript-lsp / pyright-lsp / gopls…) | claude-plugins-official | Real go-to-definition and diagnostics for the agent | `tsconfig.json` / `pyproject.toml` / `go.mod` |

Not in v1: MCP-wrapping plugins (context7, playwright, github, linear, sentry), which are excluded by Out of scope; plugin-dev and agent-sdk-dev (only for plugin or agent projects); ralph-loop (niche).

## Scenarios
### S1: Suggestions fit the project
- WHEN the welcome shows the toolkit step for a project with a web frontend
- THEN frontend-related plugins are listed first, each with a one-line reason
### S2: Confirm once, install what was picked
- WHEN the user ticks plugins and confirms
- THEN only the ticked plugins are installed, and the dialog named each one before anything changed
### S3: Already installed
- WHEN a catalog plugin is already installed
- THEN it shows as installed and cannot be ticked again
### S4: Install fails
- WHEN one plugin fails to install
- THEN that item shows the real error and a command to copy, and the other picks still install
### S5: Ask the agent
- WHEN the user asks the in-app agent to set up their toolkit
- THEN it asks which suggested plugins they want and installs the picks after the same confirm

## Spec changes
### agent-toolkit
#### ADDED Requirement: Suggested toolkit
The system SHALL offer a vetted list of Claude Code plugins during onboarding, each with a reason, ranked so that plugins matching the project's contents come first.
##### Scenario: Project fit
- WHEN the project has a web frontend
- THEN frontend plugins appear before unrelated ones
#### ADDED Requirement: Confirmed install
The system SHALL install a suggested plugin only after the user picks it and confirms a dialog naming every plugin to be installed, whether the request came from the welcome or the in-app agent.
##### Scenario: Nothing without confirm
- WHEN the user ticks plugins and closes the dialog without confirming
- THEN nothing is installed
#### ADDED Requirement: Install status
The system SHALL show each picked plugin as installed only from evidence that the agent has it, and SHALL show a failed install's real error with a command the user can run instead.
##### Scenario: Partial failure
- WHEN one of three picked plugins fails
- THEN two show installed and one shows its error and command
