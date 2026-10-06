# R078: i18n support
**Parent:** R003
**Status:** in-progress
**Order:** 130
**Tasks:** T215, T216, T217, T218, T219, T220, T221, T222, T223, T224

People who prefer a language other than English use VibeDoc in their own language, starting with Vietnamese, so the board, roadmap and test review read naturally to non-English teams.

**In scope:** the app UI's text (navigation, buttons, empty states, toasts, help and shortcuts) in English and Vietnamese; a language choice in Settings that each browser remembers (cookie); dates and numbers shown in the chosen language; adding another language means adding one translation file
**Out of scope:** translating the user's own docs, tasks or epics; MCP tool descriptions and agent replies; the docs site; right-to-left languages
**Done when:** switching Settings → Language to Tiếng Việt shows every page of the app in Vietnamese with no English left in the UI chrome, and switching back restores English without a reload

## Scenarios
### S1: Every page in Vietnamese
- WHEN the user picks Tiếng Việt in Settings and opens any page
- THEN no English interface text is left (user content, ids and keys excepted)
### S2: Back to English without a reload
- WHEN the user switches the language back to English
- THEN every interface text is English again without reloading the page
### S3: The choice survives a reload
- WHEN the user reloads the app in Vietnamese
- THEN it opens in Vietnamese with no English flash
### S4: Dates read the Vietnamese way
- WHEN the app is in Vietnamese
- THEN dates, month names and numbers use Vietnamese formats
### S5: Vietnamese letters render
- WHEN the user picks any font in Settings with Vietnamese on
- THEN letters like ạ, ế, ữ render in that font, or the font says it has none
