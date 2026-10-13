// Browser check for R098 (agent toolkit setup) on the welcome (/start) of a fixture web project:
//   S1  the toolkit step lists frontend-design and example-skills first, each with its reason and a "Fits" hint
//   S3  a plugin already in Claude Code's list (stub state) shows Installed and can't be ticked
//   S2  tick → Install selected → the dialog names every picked plugin with its commands; Cancel runs nothing;
//       Install runs only the picked ones
//   S4  one of three picks fails → the other two show Installed, the failed one shows the stub's stderr and its command
//   API POST with an id not in the catalog → 400, a foreign Origin → 403
//   S5  the in-app agent calls vibedoc_propose_toolkit (stubbed chat turn) → the chat shows the card with the preselected
//       plugin ticked; closing the dialog installs nothing; Install → the plugin installs and "Toolkit install results:"
//       goes back as the next chat message. vibedoc_propose_toolkit with an unknown preselect id → a tool error
//       listing the valid ids
// The server must run with e2e/fixtures/claude-stub first on PATH (a fake `claude` that keeps its state in the cwd).
// Fails on any browser page error. The fixture is removed in `finally`.
//
//   PATH=$PWD/e2e/fixtures/claude-stub:$PATH pnpm exec next dev -p 3081
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3081 node e2e/toolkit.mjs
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat, toolTurn } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
// a Next.js web app in a git repo, with TypeScript: web-frontend, git and lsp-ts fit
writeFileSync(path.join(fx, "package.json"), JSON.stringify({ name: "shop", scripts: { dev: "next dev" }, dependencies: { next: "16.0.0", react: "19.0.0" } }))
writeFileSync(path.join(fx, "tsconfig.json"), "{}")
mkdirSync(path.join(fx, ".git"))
writeFileSync(path.join(fx, ".claude-stub.json"), JSON.stringify({
  plugins: [{ id: "superpowers@claude-plugins-official", scope: "user", enabled: true }],
  failInstall: ["commit-commands@claude-plugins-official"],
}))
const stubLog = path.join(fx, ".claude-stub.log")
const changes = () => (existsSync(stubLog) ? readFileSync(stubLog, "utf8").trim().split("\n") : []).filter((c) => c && !c.endsWith("list --json"))
const installedIds = () => JSON.parse(readFileSync(path.join(fx, ".claude-stub.json"), "utf8")).plugins.map((p) => p.id).sort()
const post = (body, headers = {}) => fetch(`${BASE}/api/toolkit?root=${encodeURIComponent(fx)}`, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
})

const browser = await launchChrome()
const errors = []
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  await ctx.addCookies([{ name: "vibedoc-lang", value: "en", url: BASE }])
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/start?root=${encodeURIComponent(fx)}`)

  // S1
  const step = page.getByRole("region", { name: "Pick your toolkit" })
  await step.getByRole("checkbox", { name: /Frontend design/ }).waitFor()
  const order = await step.locator("[data-toolkit-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-toolkit-item")))
  assert.deepEqual(order.slice(0, 2), ["frontend-design", "example-skills"])
  assert.ok(order.includes("typescript-lsp") && !order.includes("pyright-lsp"), `LSP fit: ${order}`)
  const fd = step.locator('[data-toolkit-item="frontend-design"]')
  await fd.getByText('UI work that avoids the generic "AI look"').waitFor()
  await fd.getByText("Fits: web frontend").waitFor()
  console.log("ok  S1 frontend plugins first, each with its reason and fit")

  // S3
  const sp = step.getByRole("checkbox", { name: /Superpowers/ })
  assert.ok(await sp.isDisabled() && await sp.isChecked(), "installed plugin is checked and disabled")
  await step.locator('[data-toolkit-item="superpowers"]').getByText("Installed").waitFor()
  console.log("ok  S3 an installed plugin shows Installed and can't be ticked")

  // S2: Cancel runs nothing
  const install = step.getByRole("button", { name: "Install selected" })
  assert.ok(await install.isDisabled(), "nothing picked → Install disabled")
  await step.getByRole("checkbox", { name: /Frontend design/ }).check()
  await step.getByRole("checkbox", { name: /Anthropic example skills/ }).check()
  await install.click()
  const dialog = page.getByRole("dialog", { name: "Install these plugins in Claude Code?" })
  await dialog.getByText("claude plugin install frontend-design@claude-plugins-official").waitFor()
  await dialog.getByText("claude plugin install example-skills@anthropic-agent-skills").waitFor()
  await dialog.getByText("claude plugin marketplace add anthropics/skills").waitFor()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await dialog.waitFor({ state: "hidden" })
  assert.deepEqual(changes(), [], "Cancel ran no command")
  console.log("ok  S2 the dialog names each plugin and its commands; Cancel runs nothing")

  // S2 + S4: three picks, one fails
  await step.getByRole("checkbox", { name: /Commit commands/ }).check()
  await install.click()
  await dialog.getByText("claude plugin install commit-commands@claude-plugins-official").waitFor()
  await dialog.getByRole("button", { name: "Install", exact: true }).click()
  const failed = step.locator('[data-toolkit-item="commit-commands"]')
  await failed.getByText("Install failed").waitFor({ timeout: 30_000 })
  await failed.getByText("git clone failed (network unreachable)").waitFor()
  await failed.getByText("claude plugin install commit-commands@claude-plugins-official").waitFor()
  await fd.getByText("Installed").waitFor()
  await step.locator('[data-toolkit-item="example-skills"]').getByText("Installed").waitFor()
  assert.deepEqual(installedIds(), ["example-skills@anthropic-agent-skills", "frontend-design@claude-plugins-official", "superpowers@claude-plugins-official"])
  const installs = changes().filter((c) => c.startsWith("plugin install"))
  assert.deepEqual(installs, [
    "plugin install frontend-design@claude-plugins-official",
    "plugin install example-skills@anthropic-agent-skills",
    "plugin install commit-commands@claude-plugins-official",
  ])
  console.log("ok  S2/S4 only the picked plugins install; the failure shows its error and command, the others ✓")

  // API guards
  assert.equal((await post({ ids: ["evil"] })).status, 400)
  assert.equal((await post({ ids: ["frontend-design"] }, { origin: "https://evil.example" })).status, 403)
  console.log("ok  POST refuses unknown ids (400) and foreign origins (403)")

  // S5: the agent proposes the toolkit in chat
  const rpc = async (args) => (await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_propose_toolkit", arguments: args } }),
  })).json()
  const bad = await rpc({ preselect: ["pyright-lsp"] })
  assert.equal(bad.result?.isError, true)
  assert.match(bad.result.content[0].text, /Unknown toolkit ids: pyright-lsp\. Valid ids: .*typescript-lsp/)
  const good = await rpc({ preselect: ["typescript-lsp"] })
  assert.match(good.result.content[0].text, /- typescript-lsp — .*\(fits: lsp-ts\)/)
  assert.match(good.result.content[0].text, /- frontend-design — .* · installed/)
  console.log("ok  vibedoc_propose_toolkit lists the ranked plugins and refuses unknown preselect ids")

  const chatPage = await ctx.newPage()
  chatPage.on("pageerror", (e) => errors.push(e.message))
  const calls = await stubChat(chatPage, (n) => n === 0
    ? toolTurn("tk1", "vibedoc_propose_toolkit", { preselect: ["typescript-lsp"], note: "TypeScript project: the LSP helps me navigate." }, "Pick what you want.")
    : [{ type: "result", is_error: false, session_id: "s1" }], { root: fx })
  await chatPage.goto(`${BASE}/start?root=${encodeURIComponent(fx)}`)
  await chatPage.getByRole("button", { name: "Plan the first epics with the agent" }).click()
  const card = chatPage.locator("[data-toolkit-card]")
  await card.getByText("TypeScript project: the LSP helps me navigate.").waitFor()
  const lsp = card.getByRole("checkbox", { name: /TypeScript LSP/ })
  await lsp.waitFor()
  assert.ok(await lsp.isChecked(), "preselected plugin is ticked")
  assert.ok(await card.getByRole("checkbox", { name: /Frontend design/ }).isDisabled(), "installed earlier → disabled")
  const before = changes().length
  await card.getByRole("button", { name: "Install selected" }).click()
  const confirmDlg = chatPage.getByRole("dialog", { name: "Install these plugins in Claude Code?" })
  await confirmDlg.getByText("claude plugin install typescript-lsp@claude-plugins-official").waitFor()
  await chatPage.keyboard.press("Escape") // closes only the confirm dialog, not the chat underneath
  await confirmDlg.waitFor({ state: "hidden" })
  assert.equal(changes().length, before, "closing the dialog ran nothing")
  await card.getByRole("button", { name: "Install selected" }).click()
  await confirmDlg.getByRole("button", { name: "Install", exact: true }).click()
  await card.locator('[data-toolkit-item="typescript-lsp"]').getByText("Installed").waitFor({ timeout: 30_000 })
  assert.ok(installedIds().includes("typescript-lsp@claude-plugins-official"))
  await chatPage.getByText("Toolkit install results:", { exact: false }).first().waitFor()
  for (let i = 0; i < 50 && calls.length < 2; i++) await chatPage.waitForTimeout(100)
  assert.match(JSON.stringify(calls[1] ?? {}), /Toolkit install results:\\n- typescript-lsp: installed/)
  console.log("ok  S5 the agent's toolkit card installs after the same confirm and sends the results back")

  assert.deepEqual(errors, [], `page errors: ${errors.join("\n")}`)
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
