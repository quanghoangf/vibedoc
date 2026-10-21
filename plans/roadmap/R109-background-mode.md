# R109: Background mode
**Parent:** R002
**Status:** in-progress
**Order:** 500
**Tasks:** T569, T570, T571, T572

VibeDoc can run in the background, so the user doesn't have to keep a terminal open: they start it once, and the browser, the desktop app and their agents all use the same running VibeDoc.

**In scope:** `vibedoc start` starts VibeDoc in the background and returns the terminal; `vibedoc stop` stops it cleanly (its agent workers and test runs too); `vibedoc status` says whether it runs, at which address, since when and where its log is; a second `start` reuses the running one instead of starting another; a crashed server restarts on its own, and a crash loop stops and says so; plain `vibedoc` keeps working in the foreground as today
**Out of scope:** start at login (R110), the desktop window (R111), a menu bar / tray icon, a Settings switch for background mode
**Done when:** a user runs `vibedoc start`, closes the terminal, opens VibeDoc in the browser and from their agent, then runs `vibedoc stop` and nothing VibeDoc started is left running

<!-- vibedoc:steps -->
- **Start** — `vibedoc start` → "VibeDoc is running at http://localhost:3333", terminal free
- **Use** — browser, desktop app and agents all talk to that one VibeDoc
- **Check** — `vibedoc status` → running, address, uptime, log file
- **Stop** — `vibedoc stop` → everything VibeDoc started is gone

## Scenarios
### S1: Start in the background
- WHEN the user runs `vibedoc start` and closes the terminal
- THEN VibeDoc keeps answering at the printed address
### S2: Already running
- WHEN the user runs `vibedoc start` while VibeDoc already runs
- THEN no second copy starts, and the terminal prints the running one's address
### S3: Status
- WHEN the user runs `vibedoc status`
- THEN it says running (address, since when, log file) or not running
### S4: Clean stop
- WHEN the user runs `vibedoc stop`
- THEN VibeDoc and every worker or test run it started have exited, and `status` says not running
### S5: Crash recovery
- WHEN the background VibeDoc crashes
- THEN it is back at the same address within a few seconds; after repeated crashes it stays down and `status` shows why

## Spec changes
### cli-startup
#### ADDED Requirement: Background start
The system SHALL start in the background with `vibedoc start`, print the address and return the terminal, and SHALL reuse an already running VibeDoc instead of starting a second one.
##### Scenario: Second start
- WHEN `vibedoc start` runs while VibeDoc is already running in the background
- THEN no new server starts and the running one's address is printed
#### ADDED Requirement: Stop and status
The system SHALL stop the background VibeDoc and every process it started with `vibedoc stop`, and SHALL report with `vibedoc status` whether it runs, its address, its start time and its log file.
##### Scenario: Stop
- WHEN the user runs `vibedoc stop`
- THEN no VibeDoc process remains and `vibedoc status` says not running
#### ADDED Requirement: Crash restart
The system SHALL restart a background VibeDoc that exits unexpectedly at the same address, and SHALL stop retrying after repeated crashes and show the reason in `vibedoc status`.
##### Scenario: Crash loop
- WHEN the background VibeDoc crashes several times in a short time
- THEN it stays stopped and `vibedoc status` shows the last error
