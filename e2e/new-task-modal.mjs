// Browser check for T512 (New Task modal), on a fresh fixture project (epic R002, tasks T001 + T002):
//   1. Keyboard only: `n` opens it, the epic and two dependencies come from searchable lists, size + priority are toggles,
//      an attached image shows a thumbnail, ⌘↵ creates → the file has Phase / Depends on / Size / Priority, the epic lists it,
//      plans/tasks/assets/<id>/1.png exists, is linked, and loads in the board panel and /docs
//   2. A 10 MB file and an SVG are refused with a message; /api/files/image refuses paths outside the project
//   3. MCP vibedoc_get_attachment answers with the image itself
//   4. Start with agent: the chat gets the draft (with the draft image path), the plan card's Accept creates the task,
//      and the draft is back when the modal opens again
//   5. Title only still creates; Esc closes; Vietnamese labels at 390px without horizontal scroll
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3207 pnpm dev   # then:
//   BASE=http://localhost:3207 PW_DIR=<dir with node_modules/playwright> node e2e/new-task-modal.mjs
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3207"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const task = (id, title) => writeFileSync(path.join(fx, `plans/tasks/${id}-${title.toLowerCase()}.md`),
  [`# ${id}: ${title}`, "**Status:** 📋 Todo", "**Depends on:** —", "", "## Goal", "x", ""].join("\n"))
task("T001", "Alpha")
task("T002", "Bravo")
const tasksDir = path.join(fx, "plans/tasks")
const fileOf = (id) => readdirSync(tasksDir).find((f) => f.startsWith(`${id}-`))
const read = (rel) => readFileSync(path.join(fx, rel), "utf8")

// A real 16×16 PNG (green), built here so the browser can decode it
function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let x = 0xffffffff; for (const v of b) x = crcTable[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const W = 16, raw = Buffer.alloc((W * 3 + 1) * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) raw[y * (W * 3 + 1) + 1 + x * 3 + 1] = 200
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))])
}
const shot = { name: "shot.png", mimeType: "image/png", buffer: png() }

const plan = {
  kind: "breakdown", epic: "R002",
  tasks: [{ key: "t1", title: "Agent shaped task", size: "S (~1 hr)", body: "## Goal\nShaped by the agent\n\n![](assets/draft/1.png)" }],
}

const browser = await launchChrome()
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push(e.message))
  const calls = await stubChat(page, (n) => toolTurn(`tu${n}`, "vibedoc_propose_plan", { plan }, "Here is the task."), { root: fx })
  await page.goto(`${BASE}/board`)
  await page.getByText("Alpha", { exact: true }).first().waitFor()

  // 1. Keyboard only
  await page.keyboard.press("n")
  const dialog = page.getByRole("dialog", { name: "New Task" })
  await dialog.waitFor()
  await page.keyboard.type("Paste screenshots")
  await page.keyboard.press("Tab")
  await page.keyboard.type("R002")
  await dialog.getByRole("option", { name: /R002/ }).waitFor()
  await page.keyboard.press("Enter")
  await dialog.getByRole("button", { name: "Remove R002" }).waitFor()
  await dialog.getByRole("combobox", { name: "Depends on" }).focus()
  await page.keyboard.type("Alpha")
  await page.keyboard.press("Enter")
  await page.keyboard.type("T002")
  await page.keyboard.press("Enter")
  await dialog.getByRole("button", { name: "Remove T002" }).waitFor()
  await dialog.getByRole("button", { name: /^M — / }).focus()
  await page.keyboard.press("Enter")
  await dialog.getByRole("button", { name: "P1" }).focus()
  await page.keyboard.press("Space")
  assert.equal(await dialog.getByRole("button", { name: "P1" }).getAttribute("aria-pressed"), "true")
  await dialog.getByLabel("Description").fill("Users paste a screenshot into the form.")
  await dialog.getByLabel("Attach image").setInputFiles(shot)
  await dialog.getByRole("img", { name: "Attachment 1" }).waitFor()
  await dialog.getByLabel("Description").focus()
  await page.keyboard.press("ControlOrMeta+Enter")
  await dialog.waitFor({ state: "detached" })
  const f3 = fileOf("T003")
  assert.ok(f3, "T003 created")
  const raw = read(`plans/tasks/${f3}`)
  assert.match(raw, /^\*\*Phase:\*\* R002 — Epic$/m)
  assert.match(raw, /^\*\*Depends on:\*\* T001, T002$/m)
  assert.match(raw, /^\*\*Size:\*\* M \(3-4 hrs\)$/m)
  assert.match(raw, /^\*\*Priority:\*\* P1$/m)
  assert.match(raw, /!\[\]\(assets\/T003\/1\.png\)/)
  assert.match(read("plans/roadmap/R002-epic.md"), /^\*\*Tasks:\*\* T003$/m)
  assert.ok(existsSync(path.join(fx, "plans/tasks/assets/T003/1.png")))
  console.log("ok  keyboard: n → epic, 2 deps, size, priority, image, ⌘↵ → T003 in R002 with assets/T003/1.png linked")

  const loaded = async (scope) => {
    const img = scope.locator('img[src*="/api/files/image"]').first()
    await img.waitFor()
    await page.waitForFunction((el) => el.complete && el.naturalWidth === 16, await img.elementHandle())
  }
  await page.getByText("Paste screenshots", { exact: true }).first().click()
  await loaded(page.locator("main, body").first())
  console.log("ok  the image renders in the board task panel")
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent(`plans/tasks/${f3}`)}`)
  await loaded(page)
  console.log("ok  the image renders in /docs")

  // 2. Refusals
  await page.goto(`${BASE}/board`)
  await page.getByText("Alpha", { exact: true }).first().waitFor()
  await page.keyboard.press("n")
  await dialog.waitFor()
  await dialog.getByLabel("Attach image").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024) })
  await dialog.getByRole("alert").getByText("huge.png is too large: images can be at most 5 MB").waitFor()
  await dialog.getByLabel("Attach image").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") })
  await dialog.getByRole("alert").getByText("logo.svg isn't a PNG, JPEG, WebP or GIF image").waitFor()
  assert.equal(await dialog.getByRole("img", { name: /Attachment/ }).count(), 0)
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "detached" })
  const form = new FormData()
  form.append("task", JSON.stringify({ title: "Svg sneaks in" }))
  form.append("image", new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/png" }), "x.png")
  let res = await fetch(`${BASE}/api/tasks/create${q}`, { method: "POST", body: form })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /Only PNG, JPEG, WebP or GIF/)
  assert.equal(fileOf("T004"), undefined, "a refused image leaves no task")
  writeFileSync(path.join(path.dirname(fx), "outside.png"), png())
  for (const p of ["../outside.png", "/etc/hosts", `plans/tasks/${f3}`, "plans/../../outside.png"]) {
    res = await fetch(`${BASE}/api/files/image${q}&path=${encodeURIComponent(p)}`)
    assert.equal(res.status, 400, `${p} refused`)
  }
  res = await fetch(`${BASE}/api/files/image${q}&path=plans/tasks/assets/T003/1.png`)
  assert.equal(res.headers.get("content-type"), "image/png")
  console.log("ok  10 MB and SVG refused in the modal and by the API; nothing outside the project is served; Esc closes")

  // 3. MCP image content
  const mcp = await (await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST", headers: { "content-type": "application/json", "x-vibedoc-chat": "1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_get_attachment", arguments: { path: "assets/T003/1.png" } } }),
  })).json()
  const imgBlock = mcp.result.content.find((c) => c.type === "image")
  assert.equal(imgBlock?.mimeType, "image/png")
  assert.equal(Buffer.from(imgBlock.data, "base64").length, shot.buffer.length)
  console.log("ok  vibedoc_get_attachment returns the image")

  // 4. Start with agent
  await page.keyboard.press("n")
  await dialog.waitFor()
  await page.keyboard.type("Rough idea for search")
  await dialog.getByLabel("Description").fill("search is slow, see screenshot")
  await dialog.getByLabel("Attach image").setInputFiles(shot)
  await dialog.getByRole("button", { name: "Start with agent" }).click()
  await dialog.waitFor({ state: "detached" })
  const card = page.locator("div:has(> ul > li[data-plan-row])").last()
  await card.getByRole("button", { name: /^Accept/ }).waitFor()
  assert.match(calls[0].message, /Title: Rough idea for search/)
  assert.match(calls[0].message, /search is slow, see screenshot/)
  assert.match(calls[0].message, /plans\/tasks\/assets\/draft-[a-z0-9]+\/1\.png/)
  assert.match(calls[0].message, /vibedoc_propose_plan/)
  const draftDir = calls[0].message.match(/plans\/tasks\/assets\/(draft-[a-z0-9]+)\//)[1]
  assert.ok(existsSync(path.join(fx, "plans/tasks/assets", draftDir, "1.png")))
  await card.getByRole("button", { name: /^Accept/ }).click()
  await card.getByText("✓ Created").waitFor()
  assert.ok(fileOf("T004"), "Accept created the task")
  assert.match(read(`plans/tasks/${fileOf("T004")}`), /Shaped by the agent/)
  console.log("ok  Start with agent: chat gets the draft + draft image path; Accept on the plan card creates T004")
  // Same page session (no reload): close the chat, open New Task again
  await page.keyboard.press("Escape")
  await card.waitFor({ state: "detached" })
  await page.getByRole("button", { name: /^New task/ }).click()
  await dialog.waitFor()
  assert.equal(await dialog.getByLabel(/^Title/).inputValue(), "Rough idea for search")
  assert.equal(await dialog.getByLabel("Description").inputValue(), "search is slow, see screenshot")
  console.log("ok  the draft is back when the modal opens again")

  // 5. Title only; Vietnamese at 390px
  await dialog.getByLabel(/^Title/).fill("Plain task")
  await dialog.getByLabel("Description").fill("")
  await dialog.getByRole("button", { name: "Remove image 1" }).click()
  await dialog.getByRole("button", { name: /Create Task/ }).click()
  await dialog.waitFor({ state: "detached" })
  assert.match(read(`plans/tasks/${fileOf("T005")}`), /^# T005: Plain task$/m)
  console.log("ok  a title-only task is still created")

  await context.addCookies([{ name: "vibedoc-lang", value: "vi", url: BASE }])
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`${BASE}/board`)
  await page.waitForLoadState("networkidle")
  await page.keyboard.press("n")
  const vi = page.getByRole("dialog", { name: "Việc mới" })
  await vi.getByRole("button", { name: "Bắt đầu với agent" }).waitFor()
  await vi.getByText("Đính kèm ảnh", { exact: true }).waitFor()
  const box = await vi.boundingBox()
  assert.ok(box.x >= 0 && box.x + box.width <= 390, `modal fits 390px (${box.x}, ${box.width})`)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  console.log("ok  Vietnamese labels, fits 390px")

  assert.deepEqual(errors, [], `console errors: ${errors.join("\n")}`)
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
  rmSync(path.join(path.dirname(fx), "outside.png"), { force: true })
}
