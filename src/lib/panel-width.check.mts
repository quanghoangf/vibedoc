import assert from "node:assert/strict"
import { clampPanelWidth, panelWidthCookie, parsePanelWidth, PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH } from "./panel-width.ts"

assert.equal(parsePanelWidth(null), PANEL_DEFAULT_WIDTH)
assert.equal(parsePanelWidth("abc"), PANEL_DEFAULT_WIDTH)
assert.equal(parsePanelWidth("-5"), PANEL_DEFAULT_WIDTH)
assert.equal(parsePanelWidth("640.4"), 640)
assert.equal(clampPanelWidth(100, 1600), PANEL_MIN_WIDTH)
assert.equal(clampPanelWidth(900, 1600), 900)
assert.equal(clampPanelWidth(5000, 1600), 1360)
// a window narrower than the minimum still gets the minimum
assert.equal(clampPanelWidth(500, 300), PANEL_MIN_WIDTH)
assert.match(panelWidthCookie(612.7), /^vibedoc-panel-width=613; path=\/; max-age=\d+; samesite=lax$/)
console.log("panel-width.check: ok")
