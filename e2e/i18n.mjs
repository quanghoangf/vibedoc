// Browser check for R078 (i18n support) on a fixture project:
//   1. Settings → Appearance → Language → Tiếng Việt switches the UI at once (no reload), <html lang="vi">.
//   2. Every page in PAGES shows no English UI text: visible text and title / aria-label / placeholder are compared
//      with every English message (src/i18n/*.ts) whose Vietnamese differs. Messages with {placeholders} are matched
//      as patterns. User content, ids and keys aren't messages, so they never count; user content that could equal
//      a message (a folder named "Docs", a document's text) is marked data-user-content in the UI and skipped here.
//   3. A reload stays Vietnamese, and the server already renders lang="vi" (no English flash).
//   4. Dates read the Vietnamese way (Activity day heading, roadmap timeline months) (T216).
//   5. Every Settings font has Vietnamese letters (a @font-face covering U+1EA1 "ạ") unless settings.ts flags it
//      `noVietnamese`, and the flag shows in Vietnamese (T216).
//   6. Switching back to English restores it without a reload.
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
//
// Each R078 area task adds its pages to PAGES (`open` shows panels/dialogs whose text should be checked too).
import assert from "node:assert/strict"
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
// A task with a due date and one status change, so Activity has an event and the roadmap timeline has a marker
writeFileSync(path.join(fx, "plans/tasks/T001-sample.md"), "# T001: Sample\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n\n## Goal\nA sample.\n")
writeFileSync(path.join(fx, "plans/tasks/T002-next.md"), "# T002: Next step\n**Status:** 📋 Todo\n**Phase:** R002 — Epic\n**Depends on:** T001\n**Size:** M (2–3 hrs)\n\n## Goal\nAfter the sample.\n")
writeFileSync(path.join(fx, "plans/tasks/T003-reviewed.md"), "# T003: Reviewed thing\n**Status:** 👀 Review\n**Phase:** R002 — Epic\n\n## Goal\nA task waiting for review.\n\n## Manual tests\n### Steps\n- [ ] Open /board → the board shows\n- [x] Click a card → its panel opens\n### Regression risk\n- [ ] Dragging a card still works\n")
writeFileSync(path.join(fx, "plans/roadmap/R003-shipped.md"), "# R003: Shipped thing\n**Parent:** R001\n**Status:** done\n**Order:** 20\n**Tasks:** T099\n")
mkdirSync(path.join(fx, "docs"), { recursive: true })
mkdirSync(path.join(fx, "memory/entries"), { recursive: true })
writeFileSync(path.join(fx, "memory/MEMORY.md"), "# Project Memory\n\n## Working on now\nT001 sample, see T999.\n")
writeFileSync(path.join(fx, "memory/entries/E001-only-core-touches-fs.md"), "# E001: Only core.ts touches the file system\n**Type:** convention\n**Updated:** 2026-10-01\n\nAPI routes import from core, see T001.\n")
writeFileSync(path.join(fx, "docs/a.md"), "# A\n\nSee [B](b.md) and [missing](gone.md).\n")
writeFileSync(path.join(fx, "docs/b.md"), "# B\n\nBack to [A](a.md).\n")
writeFileSync(path.join(fx, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Due:** 2026-12-15\n**Tasks:** T001, T002, T003\n")
// Saved chats (T222): one about R002 with a plan, an edit proposal and questions waiting; one about T001
mkdirSync(path.join(fx, ".vibedoc/chats"), { recursive: true })
const msg = (role, text, extra = {}) => ({ role, text, tools: [], proposals: [], plans: [], questions: [], ...extra })
const at = new Date().toISOString()
writeFileSync(path.join(fx, ".vibedoc/chats/c-fix1.json"), JSON.stringify({
  id: "c-fix1", title: "Epic R002", sessionId: "s1", busy: false, notes: [], attach: { kind: "epic", id: "R002" }, createdAt: at, updatedAt: at,
  messages: [msg("user", "Break down epic R002 into tasks."), msg("assistant", "Here is a plan.", {
    tools: ["vibedoc_get_roadmap"],
    plans: [{ id: "p1", status: "pending", plan: { kind: "breakdown", epic: "R002", tasks: [
      { key: "t1", title: "First", size: "S (~1 hr)", body: "## Goal\nOne." },
      { key: "t2", title: "Second", dependsOn: ["t1"], due: "2026-12-01", body: "## Goal\nTwo." },
    ] } }],
    proposals: [{ id: "e1", path: "docs/a.md", status: "pending", summary: "Reword", edits: [{ old_string: "See [B](b.md)", new_string: "Read [B](b.md)" }] }],
    questions: [{ id: "q1", questions: [{ question: "Which one?", header: "Pick", multiSelect: false, options: [{ label: "Alpha" }, { label: "Beta" }] }] }],
  })],
}))
writeFileSync(path.join(fx, ".vibedoc/chats/c-fix2.json"), JSON.stringify({
  id: "c-fix2", title: "Task T001", sessionId: "s2", busy: false, notes: [], attach: { kind: "task", id: "T001" }, createdAt: at, updatedAt: at,
  messages: [msg("user", "Refine this task's spec."), msg("assistant", "Done.")],
}))
const { SANS_FONTS, MONO_FONTS } = await import("../src/lib/settings.ts")

// `scope`: CSS selectors to check instead of the whole page (the shell while page content isn't translated yet)
/** @type {{ path: string, name: string, scope?: string, open?: (page: import("playwright").Page) => Promise<void> }[]} */
const PAGES = [
  { path: "/board", name: "app shell on /board", scope: 'header.sticky, [data-sidebar="sidebar"], [aria-keyshortcuts="?"]',
  },
  // T217: the board, all four views, its popovers, the bulk bar, the task panel and the new-task dialog
  { path: "/board?v=board", name: "board: Board view + filter", open: async (page) => {
    await page.keyboard.press("f")
    await page.getByRole("dialog", { name: "Lọc" }).waitFor()
    await page.getByRole("button", { name: "Thêm điều kiện" }).click()
  } },
  { path: "/board?v=table", name: "board: Table view + bulk bar", open: async (page) => {
    await page.getByRole("checkbox", { name: "Chọn mọi việc đang hiện" }).check()
    await page.getByRole("toolbar", { name: "Thao tác hàng loạt" }).waitFor()
  } },
  { path: "/board?v=epic", name: "board: By epic view" },
  { path: "/board?v=timeline", name: "board: Timeline view" },
  { path: "/board?v=table&s=status", name: "board: sort popover", open: async (page) => {
    await page.getByRole("button", { name: /^Sắp xếp/ }).click()
    await page.getByRole("dialog", { name: "Sắp xếp" }).waitFor()
  } },
  { path: "/board?task=T001", name: "board: task panel", open: async (page) => {
    await page.getByRole("dialog").getByText("Sample", { exact: true }).waitFor()
  } },
  { path: "/board", name: "board: new task dialog", open: async (page) => {
    await page.getByRole("button", { name: /^Việc mới/ }).click()
    await page.getByRole("dialog", { name: "Việc mới" }).waitFor()
  } },
  // T218: the roadmap (map, needs attention, epic sheet + menu, dialogs, timeline) and the doc graph
  { path: "/roadmap", name: "roadmap: map + needs attention", open: async (page) => {
    await page.getByText(/mục cần chú ý$/).click()
    await page.getByText(/liên kết tới việc không tồn tại/).first().waitFor()
  } },
  { path: "/roadmap?item=R002", name: "roadmap: epic sheet + menu", open: async (page) => {
    await page.getByRole("dialog").getByRole("button", { name: "Thao tác cho R002" }).click()
    await page.getByRole("menuitem", { name: /Nhân bản/ }).waitFor()
  } },
  { path: "/roadmap?item=R002", name: "roadmap: epic edit form", open: async (page) => {
    await page.getByRole("dialog").getByRole("button", { name: "Sửa" }).click()
    await page.getByText("Nội dung (markdown)").waitFor()
  } },
  { path: "/roadmap", name: "roadmap: break down dialog", open: async (page) => {
    await page.getByRole("button", { name: /Chia nhỏ các epic/ }).click()
    await page.getByRole("dialog", { name: "Chia nhỏ các epic" }).waitFor()
  } },
  { path: "/roadmap", name: "roadmap: plan from spec dialog", open: async (page) => {
    await page.getByRole("button", { name: /Lập kế hoạch từ spec/ }).click()
    await page.getByRole("dialog", { name: "Lập kế hoạch từ spec" }).waitFor()
  } },
  { path: "/roadmap?view=timeline", name: "roadmap: timeline" },
  { path: "/graph?node=docs%2Fa.md", name: "graph: map, legend, selected file", open: async (page) => {
    await page.getByRole("complementary", { name: "Tệp đang chọn" }).waitFor()
  } },
  // T219: docs (empty state, viewer with properties + linked docs, menus, new document, select mode) and the explorer
  { path: "/docs", name: "docs: empty state + sort menu", open: async (page) => {
    await page.getByRole("heading", { name: /tài liệu/ }).first().waitFor()
    await page.getByRole("button", { name: "Sắp xếp và lọc theo ưu tiên" }).click()
    await page.getByRole("menuitemradio", { name: "Thư mục" }).waitFor()
  } },
  { path: "/docs?doc=docs%2Fa.md", name: "docs: viewer, properties, linked docs, doc menu", open: async (page) => {
    await page.getByRole("heading", { level: 1, name: "A" }).first().waitFor()
    await page.getByText("Liên kết tới").first().waitFor()
    await page.getByRole("button", { name: "Thao tác cho docs/a.md" }).last().click()
    await page.getByRole("menuitem", { name: /Chuyển vào thư mục/ }).waitFor()
  } },
  { path: "/docs?doc=docs%2Fa.md", name: "docs: edit mode toolbar", open: async (page) => {
    await page.getByRole("heading", { level: 1, name: "A" }).first().waitFor()
    await page.getByRole("tab", { name: "Sửa" }).click()
    await page.getByRole("button", { name: "In đậm" }).waitFor()
  } },
  { path: "/docs", name: "docs: new document dialog", open: async (page) => {
    await page.getByRole("button", { name: "Tài liệu mới" }).first().click()
    await page.getByRole("dialog", { name: "Chọn mẫu" }).waitFor()
  } },
  { path: "/docs", name: "docs: select mode", open: async (page) => {
    await page.getByRole("button", { name: "Chọn tài liệu" }).click()
    await page.getByText("Sao chép ngữ cảnh").waitFor()
  } },
  { path: "/explorer", name: "explorer" },
  // T220: memory (handoff, entries, entry detail + edit, cleanup, history, graph) and activity (sessions, all events)
  { path: "/memory", name: "memory: handoff + entries" },
  { path: "/memory?entry=E001", name: "memory: entry detail + history", open: async (page) => {
    await page.getByRole("button", { name: "Lịch sử" }).last().click()
    await page.getByText(/Đang tải lịch sử|Chưa được commit|Lịch sử cần git|Thay đổi chưa commit/).first().waitFor()
  } },
  { path: "/memory?entry=E001", name: "memory: entry edit form", open: async (page) => {
    await page.getByRole("button", { name: "Sửa" }).click()
    await page.getByText("Tóm tắt (một dòng)").waitFor()
  } },
  { path: "/memory?cleanup=1", name: "memory: cleanup", open: async (page) => {
    await page.getByText(/không tồn tại/).first().waitFor()
  } },
  { path: "/memory?history=1", name: "memory: MEMORY.md history" },
  { path: "/memory?view=graph", name: "memory: graph" },
  { path: "/activity", name: "activity: sessions", open: async (page) => {
    await page.getByRole("button", { name: /Agent/ }).first().waitFor()
  } },
  { path: "/activity", name: "activity: all events", open: async (page) => {
    await page.getByRole("button", { name: "Mọi sự kiện" }).click()
    await page.getByRole("group", { name: "Lọc theo loại" }).waitFor()
  } },
  // T221: test review (list, bulk bar, detail with checklist + decision, evidence view, suite)
  { path: "/manual-tests", name: "test review: list + bulk bar", open: async (page) => {
    await page.getByRole("checkbox", { name: "Chọn T003" }).check()
    await page.getByRole("toolbar", { name: "Đã chọn 1" }).waitFor()
  } },
  { path: "/manual-tests?tab=all&task=T003&view=review", name: "test review: detail + checklist + decision", open: async (page) => {
    await page.getByRole("region", { name: "Danh sách kiểm" }).waitFor()
    await page.getByText("Đang chờ bạn duyệt").first().waitFor()
  } },
  { path: "/manual-tests?tab=all&task=T003&view=evidence", name: "test review: evidence view", open: async (page) => {
    await page.getByText(/Chưa có lần chạy được ghi|Không tải được bằng chứng|Đang chờ bạn duyệt/).first().waitFor()
  } },
  { path: "/manual-tests?tab=suite", name: "test review: suite tab", open: async (page) => {
    await page.getByRole("heading", { name: "Bộ kiểm thử hồi quy" }).waitFor()
  } },
  // T222: chats (list, conversation with plan / edit / question cards, context rail, empty chat, modal), setup, guide
  { path: "/chat?id=c-fix1", name: "chat: list, cards, epic context", open: async (page) => {
    await page.getByText("Kế hoạch", { exact: true }).waitFor()
    await page.getByText(/dòng không đổi|Không có thay đổi|\+1/).first().waitFor()
    await page.getByRole("button", { name: "Chấp nhận", exact: true }).waitFor()
  } },
  { path: "/chat?id=c-fix1", name: "chat: question card Other", open: async (page) => {
    await page.getByRole("radio", { name: "Khác" }).check()
    await page.getByPlaceholder("Câu trả lời của bạn").waitFor()
  } },
  { path: "/chat?id=c-fix2", name: "chat: task context" , open: async (page) => {
    await page.getByText("Việc · T001").waitFor()
  } },
  { path: "/chat?id=gone", name: "chat: deleted chat", open: async (page) => {
    await page.getByText("Cuộc trò chuyện này đã bị xóa").waitFor()
  } },
  { path: "/chat?id=c-fix2", name: "chat: new empty chat", open: async (page) => {
    await page.getByRole("button", { name: "Trò chuyện mới" }).first().click()
    await page.getByRole("heading", { name: "Hỏi agent" }).waitFor()
  } },
  { path: "/board", name: "chat: modal", open: async (page) => {
    await page.locator('[data-sidebar="sidebar"]').getByRole("button", { name: "Epic R002" }).first().click()
    await page.getByRole("dialog").getByText("Kế hoạch", { exact: true }).waitFor()
  } },
  { path: "/setup", name: "setup: welcome", open: async (page) => {
    await page.getByRole("heading", { name: "Chào mừng đến với VibeDoc" }).waitFor()
  } },
  { path: "/setup", name: "setup: basic info", open: async (page) => {
    await page.getByRole("button", { name: /^Tối giản/ }).click()
    await page.getByText("Thông tin cơ bản").first().waitFor()
  } },
  { path: "/setup", name: "setup: templates", open: async (page) => {
    await page.getByRole("button", { name: /^Tối giản/ }).click()
    await page.getByPlaceholder("Dự án tuyệt vời của tôi").fill("Demo")
    await page.getByRole("button", { name: /^Tiếp/ }).click()
    await page.getByRole("button", { name: "Tài liệu quy trình" }).click()
    await page.getByRole("button", { name: /Chọn hết|Bỏ chọn hết/ }).waitFor()
  } },
  { path: "/setup", name: "setup: tech stack, team, preview", open: async (page) => {
    await page.getByRole("button", { name: /^Tối giản/ }).click()
    await page.getByPlaceholder("Dự án tuyệt vời của tôi").fill("Demo")
    await page.getByRole("button", { name: /^Tiếp/ }).click()
    await page.getByRole("button", { name: /^Tiếp/ }).click()
    await page.getByPlaceholder("Tìm công nghệ...").fill("Zigzag")
    await page.getByText(/để thêm/).waitFor()
    await assertVietnamese(page, "setup: tech stack")
    await page.getByRole("button", { name: /^Tiếp/ }).click()
    await page.getByText("Quy mô nhóm").waitFor()
    await assertVietnamese(page, "setup: team")
    await page.getByRole("button", { name: /^Tạo/ }).click()
    await page.getByText(/Tệp sẽ tạo|Không có tệp nào được tạo/).first().waitFor()
  } },
  // T223: every Settings section (/settings has no URL state: a click on its nav button)
  ...[
    ["Giao diện"], ["Trình soạn thảo"], ["Dự án"],
    ["Trạng thái", async (page) => { await page.getByRole("textbox").last().fill("Đang thử") }],
    ["Ứng dụng frontend", async (page) => { await page.getByText("Không tìm thấy frontend web").waitFor() }],
    ["MCP", async (page) => { await page.getByRole("button", { name: "Kiểm tra" }).click(); await page.waitForLoadState("networkidle") }],
    ["Kỹ năng", async (page) => { await page.getByRole("button", { name: /Thêm kỹ năng/ }).click() }],
    ["Agent", async (page) => { await page.getByRole("button", { name: /Thêm agent/ }).click() }],
  ].map(([section, then]) => ({ path: "/settings", name: `settings: ${section}`, open: async (page) => {
    await page.getByRole("button", { name: section, exact: true }).click()
    await page.waitForLoadState("networkidle")
    if (then) await then(page)
  } })),
  // T223: the pinned Help panel on two pages, ⌘K with a query, Quick open, an Undo toast (Arrange only rewrites layout.json)
  ...["/board", "/manual-tests"].map((p) => ({ path: p, name: `help panel on ${p}`, open: async (page) => {
    await page.locator('[aria-keyshortcuts="?"]').first().click()
    await page.getByRole("region", { name: "Trợ giúp" }).waitFor()
  } })),
  { path: "/board", name: "⌘K with a query", open: async (page) => {
    await page.keyboard.press("ControlOrMeta+k")
    await page.getByRole("dialog").getByRole("combobox").or(page.getByRole("dialog").getByRole("textbox")).first().fill("T00")
    await page.getByText("Việc & epic").first().waitFor()
  } },
  { path: "/board", name: "⌘K empty", open: async (page) => {
    await page.keyboard.press("ControlOrMeta+k")
    await page.getByText("Điều hướng").first().waitFor()
  } },
  { path: "/board", name: "Quick open", open: async (page) => {
    await page.keyboard.press("ControlOrMeta+p")
    await page.getByRole("dialog").getByRole("combobox").or(page.getByRole("dialog").getByRole("textbox")).first().fill("zzzz")
    await page.getByText("Không có tệp nào khớp").waitFor()
  } },
  { path: "/roadmap", name: "Undo toast", open: async (page) => {
    await page.getByRole("button", { name: "Sắp xếp", exact: true }).first().click()
    await page.getByRole("button", { name: "Hoàn tác" }).waitFor()
  } },
  { path: "/getting-started", name: "getting started", open: async (page) => {
    await page.locator("article [data-user-content], article p").first().waitFor()
  } },
]

// English messages that differ in Vietnamese → a matcher per message
const NUMERIC = new Set(["n", "done", "total", "critical", "major", "status"])
const dir = new URL("../src/i18n/", import.meta.url)
const english = []
for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const { en, vi } = await import(new URL(file, dir).href)
  for (const [k, v] of Object.entries(en)) {
    if (v === vi[k]) continue
    // count placeholders only match digits, so "{n} step" doesn't flag a task titled "Next step"; {id} only an item id (T001)
    const pattern = v.includes("{")
      ? new RegExp(`^${v.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}/g, (_, name) => (NUMERIC.has(name) ? "\\d+" : name === "id" ? "[A-Z]+\\d+" : ".+"))}$`)
      : null
    english.push({ key: `${file.slice(0, -3)}.${k}`, text: v, pattern })
  }
}
const isEnglish = (s) => english.find((m) => (m.pattern ? m.pattern.test(s) : m.text === s))

/** Visible text nodes + the text-like attributes of visible elements. */
async function uiStrings(page, scope) {
  return page.evaluate((scope) => {
    const out = new Set()
    const visible = (el) => el && el.checkVisibility({ visibilityProperty: true }) !== false
    const roots = scope ? [...document.querySelectorAll(scope)] : [document.body]
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = n.textContent.replace(/\s+/g, " ").trim()
        const el = n.parentElement
        if (s && el && !el.closest("script,style,[data-user-content]") && (visible(el) || el.closest(".sr-only"))) out.add(s)
      }
    }
    for (const el of roots.flatMap((r) => [r, ...r.querySelectorAll("[title],[aria-label],[placeholder]")])) {
      for (const a of ["title", "aria-label", "placeholder"]) {
        const v = el.getAttribute(a)?.trim()
        // a user-content element's title repeats its content (a path, an id); its aria-label / placeholder are still UI
        if (v && !(a === "title" && el.closest("[data-user-content]"))) out.add(v)
      }
    }
    return [...out]
  }, scope)
}

async function assertVietnamese(page, name, scope) {
  const left = (await uiStrings(page, scope)).map((s) => [s, isEnglish(s)]).filter(([, m]) => m)
  assert.deepEqual(left.map(([s, m]) => `${s}  (${m.key})`), [], `${name}: English UI text left in Vietnamese`)
}

const browser = await launchChrome()
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })

  // 1. Switch in Settings, no reload
  await page.goto(`${BASE}/settings`)
  await page.getByRole("radio", { name: "Tiếng Việt" }).click()
  await page.evaluate(() => { window.__noReload = true })
  await page.getByRole("link", { name: "Bảng" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "vi")
  assert.equal(await page.getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked"), "true")
  assert.equal(await page.evaluate(() => window.__noReload), true, "switching doesn't reload")
  console.log("ok  Settings → Tiếng Việt switches the sidebar at once, <html lang=vi>")

  // An agent move, so Activity has a session and an event to show
  const mcp = await page.request.post(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_update_task", arguments: { taskId: "T001", status: "in-progress" } } },
  })
  assert.ok(mcp.ok())

  // 2. No English left on each page
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`)
    // the sidebar is in the DOM (a modal sheet hides it from role queries, so not getByRole)
    await page.locator('[data-sidebar="sidebar"] a[href="/board"]').first().waitFor({ state: "attached" })
    await page.waitForLoadState("networkidle")
    if (p.open) await p.open(page)
    await assertVietnamese(page, p.name, p.scope)
    console.log(`ok  ${p.name}: no English UI text`)
  }

  // Dates (S4): an event today (the task move before the pages) → "Hôm nay"; the roadmap timeline's months are Vietnamese
  await page.goto(`${BASE}/activity`)
  await page.getByRole("heading", { name: "Hôm nay" }).first().waitFor()
  await page.goto(`${BASE}/roadmap?view=timeline`)
  await page.getByText(/^thg \d+ \d{4}$/).first().waitFor()
  assert.equal(await page.getByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( \d{4})?$/).count(), 0, "no English month on the axis")
  await page.getByText(/^15 thg 12$/).first().waitFor()
  console.log("ok  dates in Vietnamese: Activity says Hôm nay, the timeline shows thg months and 15 thg 12")

  // Fonts (S5): which Settings fonts have a face covering ạ (U+1EA1)
  await page.goto(`${BASE}/settings`)
  await page.getByRole("radiogroup", { name: "Ngôn ngữ" }).waitFor()
  const fonts = [...SANS_FONTS, ...MONO_FONTS].filter((f) => f.id !== "system")
  const covered = await page.evaluate((ids) => {
    const css = getComputedStyle(document.documentElement)
    const faces = [...document.fonts]
    return Object.fromEntries(ids.map((id) => {
      const family = css.getPropertyValue(`--font-${id}`).split(",")[0].trim().replace(/^['"]|['"]$/g, "")
      return [id, faces.some((f) => f.family.replace(/^['"]|['"]$/g, "") === family && f.unicodeRange.split(",").some((r) => {
        const [lo, hi = lo] = r.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h.replace(/\?/g, "0"), 16))
        return lo <= 0x1ea1 && 0x1ea1 <= (r.includes("?") ? lo + 0xff : hi)
      }))]
    }))
  }, fonts.map((f) => f.id))
  for (const f of fonts) assert.equal(covered[f.id], !f.noVietnamese, `${f.label}: Vietnamese letters ${covered[f.id] ? "present" : "missing"} but settings.ts says noVietnamese=${!!f.noVietnamese}`)
  await page.getByText("Không có chữ tiếng Việt", { exact: false }).first().waitFor()
  assert.equal(await page.getByText("Không có chữ tiếng Việt", { exact: false }).count(), fonts.filter((f) => f.noVietnamese).length)
  console.log(`ok  fonts: ${fonts.filter((f) => !f.noVietnamese).length} have Vietnamese letters; the ${fonts.filter((f) => f.noVietnamese).length} without say so`)

  // 3. Reload keeps it; the server renders it (first paint is already Vietnamese)
  await page.reload()
  await page.getByRole("link", { name: "Bảng" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "vi")
  const html = await (await page.request.get(`${BASE}/board`, { headers: { cookie: "vibedoc-lang=vi" } })).text()
  // the server sends the loading screen; the provider gets the language with it, so the shell renders vi from the start
  assert.ok(/<html[^>]* lang="vi"/.test(html), "server HTML has lang=vi")
  const plain = await (await page.request.get(`${BASE}/board`, { headers: { cookie: "vibedoc-lang=xx" } })).text()
  assert.ok(/<html[^>]* lang="en"/.test(plain), "an unknown cookie value → English")
  console.log("ok  reload stays Vietnamese; the server renders lang=vi; a bad cookie → English")

  // 4. Back to English without a reload
  await page.goto(`${BASE}/settings`)
  await page.evaluate(() => { window.__noReload = true })
  await page.getByRole("radio", { name: "English" }).click()
  await page.getByRole("link", { name: "Board" }).first().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.lang), "en")
  assert.equal(await page.evaluate(() => window.__noReload), true, "switching back doesn't reload")
  console.log("ok  English again without a reload")

  assert.deepEqual(errors, [], "no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
