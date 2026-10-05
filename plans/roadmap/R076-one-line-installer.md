# R076: One-line installer
**Parent:** R002
**Status:** in-progress
**Order:** 290
**Tasks:** T213

People without Node can install VibeDoc with one command, which opens it to users outside the JavaScript world.

**In scope:** a curl | sh installer for macOS and Linux and a PowerShell equivalent for Windows that install a self-contained build, put it on PATH (asking first), and support update and uninstall
**Out of scope:** OS package repositories, auto-update in the background
**Done when:** on a machine with no Node installed, the one-line command installs VibeDoc and `vibedoc --version` runs
