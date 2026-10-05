# Research: Spec-Driven Development (SDD) và OpenSpec
**Ngày:** 2026-10-05 · **Câu hỏi:** OpenSpec sinh ra để giải quyết vấn đề gì, giải quyết bằng cách nào, VibeDoc dùng được ý tưởng nào?

Nhãn độ chắc chắn: **Confirmed** (đọc trực tiếp từ nguồn gốc / code) · **Likely** (nguồn thứ cấp) · **Assumption** (suy luận của tôi).

---

## 1. TL;DR

OpenSpec giải quyết việc "yêu cầu chỉ nằm trong lịch sử chat" làm agent code không đoán trước được: nó bắt agent viết một proposal + spec delta để người duyệt **trước** khi code, rồi gộp delta vào một bộ spec sống (`openspec/specs/`) khi xong. Điểm mới thật sự so với Spec Kit / Kiro không phải chuỗi lệnh propose → apply → archive, mà là **spec bền vững theo capability + delta ADDED/MODIFIED/REMOVED** — thứ biến "spec-first" thành "spec-anchored". VibeDoc đã có sẵn nửa propose/apply (epic → task → `vibedoc_next_task`), cái thiếu là nửa "spec sống": nên lấy ý tưởng delta + scenario, nối vào checklist manual tests / evidence đã có, và giữ nó **tùy chọn, ở mức epic** để tránh "Markdown Madness".

---

## 2. Background

**SDD là gì.** Viết một đặc tả có cấu trúc (hành vi, tiêu chí chấp nhận) trước, rồi để agent sinh plan → task → code từ đó, thay vì "vibe coding" qua chat nơi ý định trôi mất theo cuộc hội thoại. [codemyspec, 2026]

**Ba mức cam kết** (Birgitta Böckeler, martinfowler.com, 15/10/2025) — khung hữu ích nhất tìm được:

| Mức | Spec sau khi xong task | Ví dụ |
|---|---|---|
| Spec-first | Bỏ đi | Kiro, Spec Kit (mỗi spec một branch) |
| Spec-anchored | Giữ lại, tiến hóa cùng feature | OpenSpec (`specs/` + delta) |
| Spec-as-source | Spec là thứ duy nhất người sửa, code read-only | Tessl |

**Làn sóng.** GitHub Spec Kit mở nguồn 9/2025 thường được xem là khởi đầu đợt này; Kiro (AWS) và Tessl đưa thuật ngữ ra mainstream cuối 2025–2026. **Likely**

---

## 3. Key Findings

### 3.1 OpenSpec — vấn đề nó giải quyết
1. README: *"AI coding assistants are powerful but unpredictable when requirements live only in chat history."* Mục tiêu: người và AI thống nhất **làm cái gì** trước khi có code. **Confirmed** [README]
2. Định vị đối lập với Spec Kit ("thorough but heavyweight. Rigid phase gates, lots of Markdown, Python setup") và Kiro (khóa vào IDE riêng). Năm nguyên tắc: fluid not rigid, iterative not waterfall, easy not complex, **brownfield-first**, scale từ solo tới enterprise. **Confirmed** [README]
3. Quy mô: 71,054 stars, 4,871 forks, tạo 2025-08-05, push gần nhất 2026-10-05, MIT. **Confirmed** (`gh api`). Nguồn khác ghi 50.1k vào 4/2026 → tăng nhanh. Thoughtworks Radar Vol. 34 (4/2026) xếp ở **Assess**, khen "incremental specification changes rather than comprehensive upfront specifications". **Confirmed** [Radar]

### 3.2 OpenSpec — cách nó giải quyết
4. **Cấu trúc thư mục** **Confirmed** [README, concepts.md]:
   ```
   openspec/
     specs/<capability>/spec.md      ← sự thật hiện tại của hệ thống
     changes/<change>/               ← thay đổi đang làm
       proposal.md  (why + scope)
       specs/…      (delta)
       design.md    (how, tùy chọn)
       tasks.md     (checklist)
     changes/archive/<date>-<change>/ ← đã xong, giữ nguyên ngữ cảnh
   ```
5. **Format spec**: `### Requirement: X` + câu dùng SHALL/MUST/SHOULD/MAY (RFC 2119) + `#### Scenario:` dạng GIVEN/WHEN/THEN. Scenario nên là "observable behavior… testable acceptance criteria—not implementation details". **Confirmed** [concepts.md]
6. **Delta spec**: change không chép lại cả spec, chỉ ghi `## ADDED / MODIFIED / REMOVED Requirements`. *"Two changes can touch the same spec file without conflicting, as long as they modify different requirements."* **Confirmed** [concepts.md]
7. **Archive**: khi xong, delta được merge vào `specs/`, folder change chuyển vào `archive/` với prefix ngày → specs luôn là trạng thái hiện tại, archive là lịch sử *tại sao*. **Confirmed** [concepts.md]
8. **Artifact graph** proposal → (specs, design) → tasks, định nghĩa bằng schema YAML tùy biến được. *"Dependencies are enablers, not gates… You can skip design if you don't need it."* **Confirmed** [concepts.md]
9. **Lệnh**: `/opsx:explore` (suy nghĩ, chưa ghi gì), `/opsx:propose`, `/opsx:apply`, `/opsx:verify`, `/opsx:archive`. Hỗ trợ 30+ agent (Claude, Cursor, Copilot, …) qua slash command sinh ra theo từng tool. **Confirmed** [README]
10. README có tính năng "Stores (beta)" cho planning xuyên repo và khuyên dùng model reasoning cao. **Confirmed** (theo bản tóm tắt README, chưa đọc kỹ)

### 3.3 Phê bình SDD (quan điểm ngược)
11. Böckeler thử Kiro / Spec Kit: workflow không co giãn theo kích thước vấn đề (bug nhỏ cũng phải đi đủ quy trình); *"I'd rather review code than all these markdown files"*; agent vẫn bỏ qua hoặc làm quá hướng dẫn dù context lớn; spec-as-source có nguy cơ lặp lại thất bại của Model-Driven Development. **Confirmed** [martinfowler.com]
12. marmelab ("The Waterfall Strikes Back", 11/2025): feature hiển thị ngày hiện tại sinh ra **8 file, 1.300 dòng** markdown; "double code review" (review code trong design rồi review lại code thật); agent đánh dấu task verify xong mà không viết test; SDD tốt cho greenfield, càng lớn càng lệch. **Confirmed** [marmelab]
13. Kent Beck phê SDD vì giả định "không học được gì trong lúc implement". Phản biện: SDD không phải waterfall nếu spec được **cập nhật** qua vòng lặp ngắn chứ không đóng băng. **Likely** (qua nguồn thứ cấp: Atomic Object, Augment, levelup)

---

## 4. Analysis — VibeDoc dùng được gì?

### 4.1 VibeDoc đang ở đâu
VibeDoc hiện là **spec-first** (Assumption dựa trên code đã đọc):

| OpenSpec | VibeDoc hiện có | Ghi chú |
|---|---|---|
| `proposal.md` | Epic `R*.md`: In scope / Out of scope / **Done when** | Confirmed (`R060-…md`) |
| `tasks.md` | `plans/tasks/T*.md`: Goal / Scope / Acceptance criteria / Verify | Confirmed (`T156-…md`) — chi tiết hơn OpenSpec |
| `design.md` | ADR `docs/architecture/decisions/` | Confirmed |
| `/opsx:propose` | `vibedoc_propose_plan` (breakdown) + `/epic-breakdown` | Confirmed (`src/lib/plan.ts`) |
| `/opsx:apply` | `vibedoc_next_task` + `/work-epic` | Confirmed |
| `/opsx:verify` | `## Manual tests` + evidence (R060) | Confirmed — **mạnh hơn** OpenSpec (có screenshot/run thật) |
| `openspec/specs/` (sự thật sống theo capability) | **Không có** | PRODUCT.md là mức sản phẩm; `docs/architecture/03-services` là mô tả kỹ thuật, không phải hành vi |
| Delta + archive merge | **Không có** | Task Done → nằm yên, không cập nhật tài liệu nào theo cấu trúc |
| `/opsx:explore` | Agent chat (gắn epic/task) | Gần tương đương |

Triệu chứng của việc thiếu spec sống thấy ngay trong repo: `PRODUCT.md` ghi "36 tools", `CLAUDE.md`/HLD ghi "40 tools" — **Confirmed**. Hành vi thật của một capability (vd. "board views") phải ghép lại từ ~10 task Done + một dòng dài trong MEMORY.md "Key conventions". MEMORY.md đang gánh vai trò spec sống một cách không có cấu trúc.

### 4.2 Nên lấy — xếp theo giá trị / chi phí

**1. Scenario = checklist manual tests (lấy ngay, gần như miễn phí).** Scenario WHEN/THEN của OpenSpec chính là thứ mà một item `## Manual tests` + evidence run step đã chứng minh (`matchItems` trong `src/lib/evidence.ts` khớp theo text). Khuyến nghị: khi breakdown, `Done when` của epic được viết thành vài scenario WHEN/THEN, và các scenario đó **seed** checklist manual tests của task. Không thêm file mới; evidence R060 trở thành "verify spec" thật — điều marmelab chỉ ra là SDD hiện tại thiếu (agent tick verify mà không làm).

**2. Spec sống theo capability + delta ở mức epic (ý tưởng chính, tùy chọn).**
- `docs/specs/<capability>.md` theo format Requirement/Scenario (hoặc tái dùng `docs/` sẵn có với frontmatter `kind: spec`).
- Epic có thể khai báo `**Specs:** board-views` và một section `## Spec changes` với ADDED/MODIFIED/REMOVED.
- Khi epic chuyển `done` → VibeDoc đề xuất merge delta vào spec qua cơ chế **đã có**: `vibedoc_propose_edit` (old/new spans) + diff + Accept. Người duyệt, không tự động ghi.
- Epic done chính là "archive": file R*.md vẫn ở chỗ cũ, có ngày Done — không cần thư mục archive riêng.
- MCP: `vibedoc_get_task` / `vibedoc_next_task` gắn thêm `## Related spec` (giống `## Related memory` / `## Related files` hiện có) → agent đọc hành vi hiện tại trước khi sửa. Đây là chỗ giải quyết đúng vấn đề brownfield.

**3. Graph / drift (sau).** `getDocGraph()` đã resolve link task/epic/ADR; thêm spec như một node kind cho phép cảnh báo "epic done nhưng spec chưa merge delta" — cùng kiểu drift `roadmap-health.ts` đã làm.

### 4.3 Không nên lấy
- **Chuỗi slash command `/opsx:*`** — VibeDoc đã có tương đương, thêm chỉ gây trùng.
- **Spec bắt buộc cho mọi task / mọi bug** — đúng cái bẫy Böckeler và marmelab mô tả (1.300 dòng cho một feature nhỏ). Giữ nguyên tinh thần ADR-005 (nothing blocks done): spec là **enabler, không phải gate**.
- **Spec-as-source** (Tessl) — trái với VibeDoc: code và docs đều là file người sửa trực tiếp.
- **Thư mục `openspec/` riêng** — VibeDoc nên đọc được nó (import, như R052 làm với Claude memory) hơn là ép cấu trúc đó lên người dùng.

### 4.4 Một cơ hội định vị (Assumption)
OpenSpec là CLI + markdown, không có UI. Người dùng của nó review proposal/delta trong editor. VibeDoc có sẵn board, diff view, evidence với screenshot. "Trình xem/duyệt OpenSpec" (đọc `openspec/changes/*` thành epic, `tasks.md` thành checklist) là một tích hợp nhỏ cho một cộng đồng 71k stars — đáng cân nhắc như một epic riêng sau khi có spec sống.

---

## 5. Open Questions
- **Merge xung đột cùng requirement.** OpenSpec chỉ hứa không xung đột khi hai change chạm *khác* requirement. Hai change cùng MODIFIED một requirement thì sao? Tôi không tìm thấy tài liệu nào mô tả. VibeDoc có `withRoadmapLock` và cơ chế apply span vào Yjs buffer — có thể làm tốt hơn, nhưng cần thiết kế.
- **Spec có thật sự được giữ cập nhật?** Không tìm thấy dữ liệu thực nghiệm (khảo sát, case study có số) cho thấy team dùng OpenSpec giữ được `specs/` đồng bộ sau vài tháng. Thoughtworks mới ở mức Assess.
- **Ai viết spec ban đầu cho repo brownfield?** OpenSpec để specs lớn dần theo từng change. Với VibeDoc (60 epic đã xong), có nên sinh spec ban đầu từ epic + task Done + MEMORY.md không? Chi phí review lớn.
- **Format spec của agent tuân thủ đến đâu?** Böckeler và marmelab đều báo agent bỏ qua spec. Chưa có số đo cho OpenSpec cụ thể.

---

## 6. Sources
| Nguồn | Loại | Ngày |
|---|---|---|
| [Fission-AI/OpenSpec — README](https://github.com/Fission-AI/OpenSpec/) | Repo gốc | truy cập 2026-10-05 |
| [OpenSpec docs/concepts.md](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md) | Tài liệu gốc | truy cập 2026-10-05 |
| GitHub API `repos/Fission-AI/OpenSpec` | Số liệu gốc | 2026-10-05 |
| [Thoughtworks Technology Radar — OpenSpec](https://www.thoughtworks.com/radar/tools/openspec) | Bên thứ ba | Vol. 34, 4/2026 |
| [Böckeler — Understanding SDD: Kiro, spec-kit, Tessl (martinfowler.com)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) | Chuyên gia | 2025-10-15 |
| [marmelab — Spec-Driven Development: The Waterfall Strikes Back](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html) | Blog thực nghiệm | 2025-11-12 |
| [Atomic Object — SDD Is Not Waterfall](https://spin.atomicobject.com/spec-driven-vs-waterfall/) | Blog | không rõ ngày |
| [Augment — SDD vs Waterfall](https://www.augmentcode.com/guides/spec-driven-development-vs-waterfall) | Blog vendor | không rõ ngày |
| [codemyspec — SDD in 2026: Guide and Tool Comparison](https://codemyspec.com/blog/spec-driven-development) | Blog vendor | 2026 |
| [Thoughtworks podcast — What is SDD](https://www.thoughtworks.com/insights/podcasts/technology-podcasts/what-is-spec-driven-development) | Podcast | không rõ ngày, chưa nghe |

Bỏ qua: bài Medium "30+ agentic coding frameworks" (không xác định được ngày/tác giả).

---

## 7. Phụ lục: tính năng từ các tool SDD khác (2026-10-05)

| Tool | Tính năng | Ý nghĩa | VibeDoc |
|---|---|---|---|
| Spec Kit | `/speckit.clarify` | "Identify underspecified areas… asking up to 5 highly targeted clarification questions and encoding answers back into the spec" **Confirmed** | Gợi ý sửa `/epic-breakdown`, không thành epic |
| Spec Kit | `[NEEDS CLARIFICATION: …]` | Bắt LLM đánh dấu chỗ mơ hồ thay vì đoán **Confirmed** | Như trên |
| Spec Kit | `/speckit.analyze` | "Non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md" **Confirmed** | → R068 (coverage check) |
| Spec Kit | `/speckit.checklist` | "Unit tests for English", kiểm tra chất lượng yêu cầu **Confirmed** | Bỏ qua |
| Spec Kit | constitution | Nguyên tắc dự án **Confirmed** | Gộp vào R067 (đối chiếu conventions) |
| Kiro | EARS `WHEN … THE SYSTEM SHALL …`, steering files, agent hooks | **Likely** (nguồn thứ cấp) | EARS → R066/R068; hooks → R027 Plugin system |
| Traycer | Verification: so implementation với plan, nhận xét Critical/Major/Minor/Outdated | **Likely** (docs.traycer.ai) | → R067 |
| BMAD | Story file tự chứa: lý do, ràng buộc, test, link về PRD | **Likely** | Task `T*.md` đã làm điều này |
| Tessl | Spec-as-source; đầu 2026 chuyển registry sang "package manager for evaluated skills" | **Likely** | Không lấy |

Kết quả: roadmap thêm R066–R070 (Living capability specs, Spec verification review, Scenarios as acceptance tests, Spec changes on epics, OpenSpec import).

Nguồn thêm: [github/spec-kit](https://github.com/github/spec-kit) (templates/commands/clarify.md, analyze.md, checklist.md, spec-driven.md), [Kiro docs](https://kiro.dev/docs/getting-started/first-project/), [Traycer verification](https://docs.traycer.ai/tasks/verification), [BMAD explained — codemyspec](https://codemyspec.com/blog/bmad-method-explained), [Tessl review 2026 — codemyspec](https://codemyspec.com/blog/tessl-review).
