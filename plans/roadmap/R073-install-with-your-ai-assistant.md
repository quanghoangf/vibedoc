# R073: Install with your AI assistant
**Parent:** R002
**Status:** in-progress
**Order:** 260
**Tasks:** T211

A user pastes one prompt into Claude Code, Cursor or another agent and it installs VibeDoc, connects it and reports back, so setup takes no reading at all.

**In scope:** a copy-paste prompt on the landing page and in the docs that checks Node, installs VibeDoc, connects the MCP server for the user's tool, installs the Claude Code plugin where it applies, and reports what actually happened; it asks before anything that needs admin rights and never edits shell startup files
**Out of scope:** installers per IDE, changing the user's Node version
**Done when:** in a fresh project, pasting the prompt into Claude Code leaves VibeDoc running, connected over MCP, with the /vibedoc:* commands available, and the agent's report says so
