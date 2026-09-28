# Brainstorm: Roadmap page
**Date:** 2026-09-28

## Frame
- **Space:** VibeDoc — local-first kanban/docs + MCP server cho AI coding agent
- **User:** dev solo / team nhỏ dùng AI agent (Claude Code, Cursor) trong repo của họ
- **Limits:** không database, file system là source of truth, `fs` chỉ trong `core.ts`, `emitUpdate()` sau mọi mutation
- **Goal:** feature trong sản phẩm open-source hiện có, không phải sản phẩm riêng

## Vấn đề thật (trước khi nói feature)
`ROADMAP.md` của chính VibeDoc đã **drift**:
- "Drag-and-drop kanban" vẫn nằm ở Near-term → `T001` đã Done
- "Theme customization", "Task creation UI" nằm ở v2.0 → đã có trong app

Nguyên nhân: roadmap là file markdown rời, không nối với task, AI agent không bao giờ đụng tới nó.
→ Một page chỉ để *xem đẹp hơn* không giải quyết được drift. Giá trị nằm ở **giữ roadmap đúng với thực tế**.

## Ideas

| # | Tên | One-liner | Problem | Quick risk |
|---|-----|-----------|---------|-----------|
| 1 | Roadmap Viewer | Render `ROADMAP.md` thành các cột horizon | Markdown dài khó scan | Chỉ là docs viewer đẹp hơn |
| 2 | Horizon Board + inline edit | Kéo item giữa horizon, sửa/thêm/xóa tại chỗ, ghi lại `ROADMAP.md` | Reprioritize = cắt dán text | Round-trip markdown tự do làm hỏng format |
| 3 | Item ↔ Task link | Item khai báo `T012, T013`, progress bar tính từ status task | Không biết item đã làm tới đâu | Cần convention link, user phải tuân theo |
| 4 | Drift detector | Cảnh báo item có task đã Done hết nhưng chưa ở Shipped; task không thuộc item nào | Roadmap stale (đúng như hiện tại) | Phụ thuộc #3 |
| 5 | Roadmap MCP tools | `vibedoc_get_roadmap`, `vibedoc_update_roadmap_item` | AI xong việc nhưng không cập nhật roadmap | AI tự đổi priority lung tung |
| 6 | Break down item → tasks | Nút sinh file `T*.md` từ 1 roadmap item (Anthropic SDK đã có sẵn) | Khoảng trống giữa ý tưởng và task làm được | Task chất lượng thấp, scope lớn |
| 7 | Timeline / Gantt | Item có ngày, vẽ timeline | "Khi nào ship?" | ROADMAP tự nói "not a schedule"; ngày tháng của dev solo là giả |
| 8 | Shipped ↔ Changelog | Item Shipped gắn version từ `CHANGELOG.md` | Không biết cái gì ship lúc nào | Nice-to-have |
| 9 | Roadmap template trong Setup wizard | Wizard sinh `ROADMAP.md` Now/Next/Later | Project mới không có roadmap | Nhỏ, không phải core |
| 10 | Voting / comment | Team vote item | Ưu tiên theo team | App single-user local → vô nghĩa |

## Gut-check (Demand / Buildability / Moat, 0–5)

| # | D | B | M | Tổng | Verdict |
|---|---|---|---|------|---------|
| 2 | 4 | 4 | 1 | 9 | **Giữ** — đây là cái user yêu cầu |
| 5 | 4 | 5 | 4 | 13 | **Giữ** — đúng DNA VibeDoc (AI + human chung file) |
| 3+4 | 5 | 3 | 4 | 12 | **Giữ** — giải quyết drift, gộp lại làm 1 |
| 1 | 2 | 5 | 0 | 7 | Gộp vào #2 |
| 6 | 3 | 3 | 3 | 9 | Để sau, đã nằm trong Long-term |
| 8 | 2 | 4 | 1 | 7 | Để sau |
| 9 | 2 | 5 | 1 | 8 | Để sau |
| 7 | 1 | 3 | 0 | 4 | **Giết** — mâu thuẫn triết lý roadmap |
| 10 | 0 | 2 | 0 | 2 | **Giết** — không có team mode |

## Top 3

### A. Horizon Board + inline edit (#2)
- **Key bet:** `ROADMAP.md` parse được bằng convention đơn giản (`## ` = horizon, `- **Title** — desc` = item) mà không phá file của user.
- **Validation rẻ nhất:** viết parser + serializer, chạy round-trip trên `ROADMAP.md` hiện tại → output phải giống hệt input.
- **Tương tự:** GitHub Projects roadmap view, Linear roadmap, Productboard — đều cần DB/cloud; không cái nào sống trong file markdown của repo.

### B. Roadmap MCP tools (#5)
- **Key bet:** agent sẽ gọi tool này nếu `vibedoc_update_task … done` gợi ý "item roadmap X có thể chuyển Shipped".
- **Validation rẻ nhất:** thêm 1 tool read-only, xem Claude Code có tự dùng nó khi hỏi "what's next?" không.
- **Tương tự:** Linear MCP, GitHub MCP (issues/milestones) — cloud, không local-first.

### C. Item ↔ Task link + drift detector (#3 + #4)
- **Key bet:** user chịu ghi `(T012, T013)` sau item; hoặc task có field `**Roadmap:**`.
- **Validation rẻ nhất:** link thủ công 3 item trong `ROADMAP.md` của VibeDoc, xem progress bar + cảnh báo drift có bắt đúng T001 không.
- **Tương tự:** Jira epic progress, Linear project progress.

## Khuyến nghị
MVP = **A + B-lite** (1 tool read + 1 tool update). C làm vòng 2, nhưng **chốt cú pháp link ngay từ MVP** để không phải migrate file sau.
Giết #7 và #10.

## Decisions (2026-09-28)
1. **Storage: mỗi item một file** — `plans/roadmap/R*.md`, format `**Key:** Value` giống task.
2. **Edit UX: structured + "Edit raw"** — "Edit raw" mở file `R*.md` của item trong docs editor.
3. **Task link: chốt cú pháp, làm sau** — MVP parse `**Tasks:** T001, T012` và hiện chip; progress + drift ở vòng 2.

### UI: kiểu roadmap.sh (2026-09-28, thay cho horizon board)
Tham chiếu: roadmap.sh/frontend — trục dọc node chính, node con rẽ nhánh hai bên bằng đường chấm, badge trạng thái.
4. **Trục = horizon/milestone** (Shipped → Near-term → v2.0 → Long-term); feature là nhánh. 2 cấp ở MVP, cấp 3 (nhóm kiểu npm/yarn/pnpm) để vòng 2.
5. **Kéo thả tự do** — tọa độ lưu riêng ở `plans/roadmap/layout.json`, **không** trong `R*.md` (trình bày ≠ nội dung). Cần `@xyflow/react` (React Flow): pan/zoom, drag, edge có sẵn.
   ```json
   { "R004": { "x": 640, "y": 312 } }
   ```
   - Item **không có** trong `layout.json` (AI tạo qua MCP, hoặc vừa import) → tự đặt cạnh node cha theo `Order`, luân phiên trái/phải.
   - Key trỏ tới item đã xóa → bỏ qua, dọn ở lần ghi kế tiếp.
   - Quan hệ `Parent` **ở lại trong item** (là ngữ nghĩa, AI tạo item chỉ ghi 1 file). Xóa `layout.json` chỉ mất vị trí, không mất cấu trúc.
   - Kéo xong mới ghi file (on drag stop), không ghi trong lúc kéo.
6. **Style theo theme app** — mượn bố cục roadmap.sh (viền đậm, node chính ≠ node phụ, đường chấm, badge), màu lấy từ `--color-*`/accent; dark/light tự đúng.

### Format item (đề xuất)
```markdown
# R004: Drag-and-drop kanban
**Parent:** R001
**Status:** done | in-progress | planned
**Order:** 20
**Tasks:** T001

Kéo thẻ giữa các cột để đổi status.
```
- Không có `Parent` = node trên trục (horizon). Có `Parent` = nhánh.
- `Status` → badge: ✓ done (xanh), ◐ in-progress (accent), ○ planned (xám).
- `Order` quyết định thứ tự trục và vị trí mặc định của nhánh (bước nhảy 10).
- Tọa độ không nằm ở đây — xem `layout.json`.

### Hệ quả phải xử lý
- **`ROADMAP.md` hiện có:** hai nguồn sự thật = drift lần nữa. Đề xuất: import một lần thành `R*.md`, rồi thay `ROADMAP.md` bằng dòng trỏ tới `plans/roadmap/` (hoặc xóa).
- **Mất góc nhìn một file trên GitHub:** chấp nhận; page Roadmap là góc nhìn tổng.
- **`core.ts`:** thêm `listRoadmap()`, `getRoadmapItem()`, `createRoadmapItem()`, `updateRoadmapItem()`, `deleteRoadmapItem()` — tái dùng parser `**Key:** Value` của task.
