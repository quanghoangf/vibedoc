# Brainstorm — Agent Chat Sidebar trong VibeDoc

**Ngày:** 2026-09-28
**Mục tiêu:** Sidebar chat với agent ngay trong UI, dùng để sửa doc nhanh. Tính phí vào **subscription Claude đang login ở terminal** (Claude Code 2.1.283), không dùng API key.

---

## TL;DR

**Làm giống OpenClaw:** Next.js route spawn `claude -p --output-format stream-json`, stream kết quả về browser qua SSE, và **chỉ cho agent dùng tool MCP của VibeDoc** (`vibedoc_read_doc`, `vibedoc_write_doc`, ...). Tắt hết tool native (Edit/Write/Bash).

Lý do: (1) CLI tự dùng login trên máy nên tính vào subscription. (2) Mọi lần ghi file đi qua `core.ts` + `emitUpdate()`, nên board/editor tự refresh và không phá rule kiến trúc của project.

Channels (đẩy message vào đúng session terminal đang mở) là phương án 2. Demo được, nhưng còn research preview và dễ vỡ.

---

## 1. Research: app khác dùng Claude subscription thế nào

| App | Cách kết nối | Auth | Ghi chú |
|---|---|---|---|
| **OpenClaw** | Spawn `claude` CLI làm subprocess: `--output-format stream-json --include-partial-messages`, `--session-id` để giữ hội thoại, giữ 1 process "warm" cho các turn liên tiếp | Dùng login Claude Code có sẵn trên máy. "Never reads, persists, refreshes, or forwards native tokens" | **Tắt tool native của Claude**, chỉ expose tool của OpenClaw qua 1 MCP server loopback HTTP (có token cho mỗi lần chạy) |
| **claude-code-webui** (sugyan) | Backend spawn `claude` CLI, stream JSON về web | Login local | Web UI đơn giản, localhost:8080 |
| **CloudCLI / claudecodeui** (siteboon) | Spawn CLI (Claude Code, Codex, Cursor CLI...) | Login local | Quản lý session/project từ mobile và web |
| **Opcode** (trước là Claudia) | Tauri app, spawn CLI | Login local | ~22k stars, đã ngừng commit từ 10/2025 |
| **fakechat** (Anthropic, plugin chính thức) | **Channel**: MCP server stdio đẩy `notifications/claude/channel` vào session đang chạy. Claude trả lời qua tool `reply` | Session terminal hiện tại | Đây chính là "chat UI localhost đẩy vào terminal". Research preview |

**Kết luận:** Không ai "lấy token" ra để gọi API. Tất cả đều **spawn CLI chính chủ** và để CLI tự lo auth. Đây là con đường duy nhất vừa dùng được subscription vừa không vi phạm policy.

### Tình trạng policy (Confirmed, tính đến 09/2026)
- 02/2026: Anthropic nhắc lại rằng bên thứ ba không được "offer Claude.ai login" hay route request qua credentials Free/Pro/Max thay cho user.
- 04/04/2026: chặn OpenClaw dùng subscription → 13/05 đảo ngược → 15/06 tạm dừng kế hoạch "Agent SDK credit".
- **Hiện tại:** Agent SDK, `claude -p` và app bên thứ ba vẫn **trừ vào usage limit của subscription**.
- **Với VibeDoc:** tự dùng trên máy mình thì OK. Publish lên npm để *người khác* dùng login của họ thì là **vùng xám**. Cần fallback sang API key (đã có sẵn `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` ở `src/lib/core.ts:560`).

---

## 2. Các hướng kỹ thuật (đi rộng)

### A. Spawn `claude -p` từ Next.js route ⭐
- **Là gì:** `POST /api/chat` → `child_process.spawn('claude', ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--resume', sid, '--mcp-config', vibedocMcp, '--strict-mcp-config', '--allowedTools', 'mcp__vibedoc__*', ...])`. Parse JSONL, rồi đẩy về browser qua SSE.
- **Được:** subscription, streaming từng token, resume session, không thêm dependency, giống hệt OpenClaw.
- **Rủi ro:** `-p` là non-interactive, nên tool nào không có trong allowlist sẽ bị **deny** (không hỏi). Đây là điều mình muốn. Mỗi turn spawn 1 process nên chậm ~1–2s để khởi động. Nâng cấp sau bằng `--input-format stream-json` và giữ process warm.

### B. Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Là gì:** wrapper TS của chính CLI đó. Có `query()`, in-process MCP server, hooks.
- **Được:** API đẹp hơn, typed messages, hooks để chặn tool.
- **Rủi ro:** thêm dependency cho việc mà A làm được bằng ~80 dòng. Docs chính thức ghi "SDK requires API key" (02/2026), trái ngược với thực tế là nó dùng login local → dễ bị đổi policy nhắm thẳng vào SDK. **Để dành, dùng khi A cần hooks.**

### C. Channels: đẩy vào đúng session terminal đang mở
- **Là gì:** 1 MCP server stdio nhỏ (process riêng, không phải Next route) khai báo `capabilities.experimental['claude/channel']`. UI POST message → server emit `notifications/claude/channel` → Claude trong terminal xử lý → gọi tool `reply` → UI nhận qua SSE.
- **Được:** đúng nghĩa đen "dùng Claude ở terminal này". Có thêm permission relay (`claude/channel/permission`) để approve tool từ UI.
- **Rủi ro:** research preview. Phải chạy `claude --dangerously-load-development-channels server:vibedoc`. **Không stream token**, chỉ nhận được message cuối qua `reply`. Chung context với việc đang làm ở terminal. Terminal tắt thì chat chết.

### D. Remote Control / Claude app
- Điều khiển session local từ claude.ai hoặc mobile. **Không embed được vào UI của mình.** Loại.

### E. API key trực tiếp (`@anthropic-ai/sdk`, đã có)
- Chắc chắn nhất, nhưng tính tiền API, **không đúng yêu cầu**. Chỉ giữ làm fallback cho user không có Claude Code.

---

## 3. Ý tưởng feature cho chat panel (sửa doc hiệu quả)

| # | Tên | Một dòng | Pain nó fix |
|---|---|---|---|
| 1 | **Doc-aware chat** | Tự đính kèm doc đang mở và vùng đang select vào prompt | Không phải copy-paste context |
| 2 | **Diff-to-accept** | Agent đề xuất sửa → UI hiện diff → Accept/Reject | Sợ agent ghi đè doc không kiểm soát |
| 3 | **Slash actions** | `/tighten`, `/translate`, `/add-diagram`, `/split` trên selection | Lệnh lặp lại mà phải gõ prompt dài |
| 4 | **@-mention doc/task** | `@docs/HLD.md` `@T012` để kéo thêm context | Agent không biết doc nào liên quan |
| 5 | **Sửa nhiều doc cùng lúc** | "Đổi tên ServiceX ở mọi doc" → danh sách diff | Refactor doc bằng tay rất mệt |
| 6 | **Annotate thay vì sửa** | Agent dùng `vibedoc_annotate_doc` để để lại comment | Review doc không phá nội dung |
| 7 | **Session theo project** | Mỗi project có 1 `session-id`, `--resume` khi mở lại | Mất context mỗi lần reload |
| 8 | **Tool-call timeline** | Hiện các bước "read_doc → write_doc" trong panel | Không biết agent đang làm gì |
| 9 | **Terminal bridge (C)** | Nút "gửi sang session terminal" | Muốn dùng đúng session đang code |

### Chấm điểm (0–5)

| # | Nhu cầu | Dễ build (MVP ≤2 tuần) | Khác biệt | Tổng |
|---|---|---|---|---|
| 1 Doc-aware chat | 5 | 5 | 2 | **12** |
| 2 Diff-to-accept | 5 | 3 | 4 | **12** |
| 3 Slash actions | 4 | 5 | 2 | 11 |
| 7 Session theo project | 4 | 5 | 1 | 10 |
| 8 Tool-call timeline | 3 | 4 | 2 | 9 |
| 4 @-mention | 4 | 3 | 2 | 9 |
| 5 Multi-doc edit | 3 | 2 | 4 | 9 |
| 6 Annotate | 3 | 4 | 2 | 9 |
| 9 Terminal bridge | 2 | 2 | 4 | 8 |

Nói thẳng: #1, #3, #7 là "table stakes", Cursor và Notion AI đều có. **Chỗ VibeDoc khác biệt là #2 + #5**: agent sửa doc *có kiểm soát*, và nó đã biết tasks/ADR/memory qua MCP sẵn có.

---

## 4. Top 3

### 🥇 Engine A + Doc-aware chat (#1 + #7 + #8)
- **Key bet:** `claude -p` spawn từ Next.js chạy ổn định trên subscription, và latency mỗi turn chấp nhận được (≤3s tới token đầu).
- **Validate rẻ nhất (15 phút):**
  ```bash
  env -u ANTHROPIC_API_KEY claude -p "list docs" \
    --output-format stream-json --verbose --include-partial-messages \
    --mcp-config '{"mcpServers":{"vibedoc":{"type":"http","url":"http://localhost:3000/api/mcp"}}}' \
    --strict-mcp-config --allowedTools "mcp__vibedoc__*"
  ```
  Kiểm tra: gọi được `vibedoc_list_docs`, và `/status` vẫn là subscription (không phải API).
- **Đối thủ gần:** claude-code-webui, CloudCLI. Nhưng đó là "Claude Code trên web" chung chung, không hiểu doc/task.

### 🥈 Diff-to-accept (#2)
- **Key bet:** user muốn review trước khi ghi, không muốn agent ghi thẳng.
- **Cách làm lười nhất:** thêm tool `vibedoc_propose_edit` (không ghi file, chỉ emit SSE `edit_proposed` kèm `{path, newContent}`). UI render diff (CodeMirror merge view) → Accept thì gọi `POST /api/docs` như bình thường.
- **Validate:** làm prototype với 1 doc và tự dùng 3 ngày. Nếu lần nào mình cũng bấm Accept mà không đọc, thì bỏ bước này và cho ghi thẳng + undo.
- **Đối thủ:** Cursor (code), Notion AI (doc). Chưa ai làm cho `docs/` trong repo có kèm context task.

### 🥉 Terminal bridge qua Channels (#9 / C)
- **Key bet:** user thật sự cần *cùng một session* với terminal, chứ không chỉ cần *cùng tài khoản*.
- **Góc nhìn thẳng:** mình nghĩ yêu cầu thật của bạn là "không trả tiền API". A đã giải quyết điều đó. C chỉ đáng làm nếu bạn muốn chat UI ra lệnh cho agent **đang code** ở terminal.
- **Validate:** cài `fakechat@claude-plugins-official`, dùng 1 ngày. Nếu thấy hữu ích thì fork thành channel `vibedoc`.

---

## 5. Rủi ro lớn nhất cần quyết trước khi code

1. **Ghi đè Yjs buffer.** `MarkdownEditor.tsx` dùng Yjs (`ws-server.js`). Nếu agent ghi đĩa trong khi doc đang mở trong editor, sẽ conflict. Chọn một:
   - (a) Agent ghi đĩa → `emitUpdate('doc_updated')` → editor reload. **Lười nhất.** Mất phần user đang gõ dở nếu chưa save.
   - (b) Agent đề xuất → UI apply vào Y.Doc. An toàn, và khớp tự nhiên với Diff-to-accept. ← **Mình chọn cái này**, vì #2 đằng nào cũng cần.
2. **`ANTHROPIC_API_KEY` leak vào child process.** Nếu env của Next.js có key này, `claude` sẽ **tính tiền API thay vì subscription**. Phải spawn với env đã xoá key.
3. **Không dùng tool native.** Tool native `Edit`/`Write` sẽ bỏ qua `core.ts` và `emitUpdate()`. Bắt buộc có `--strict-mcp-config` + allowlist `mcp__vibedoc__*`.
4. **Policy thay đổi.** Đã đổi 3 lần trong 2026. Giữ fallback API key. Khi đóng gói npm, ghi rõ trong README là feature này "dùng Claude Code đã cài trên máy bạn".

---

## Sources
- [Anthropic closes door on subscription use of OpenClaw — The Register](https://www.theregister.com/2026/04/06/anthropic_closes_door_on_subscription/)
- [Anthropic reinstates OpenClaw… with a catch — VentureBeat](https://venturebeat.com/technology/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch)
- [Use the Claude Agent SDK with your Claude plan — Claude Help Center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- [Anthropic officially bans subscription auth for third-party use — AlternativeTo](https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use)
- [OpenClaw — CLI backends](https://docs.openclaw.ai/gateway/cli-backends)
- [OpenClaw — Anthropic provider](https://docs.openclaw.ai/providers/anthropic)
- [Claude Code — Channels](https://code.claude.com/docs/en/channels)
- [Claude Code — Channels reference](https://code.claude.com/docs/en/channels-reference)
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui)
- [siteboon/claudecodeui (CloudCLI)](https://github.com/siteboon/claudecodeui)
- [Best Claude Code GUI in 2026 — Nimbalyst](https://nimbalyst.com/blog/best-claude-code-gui-tools-2026/)
