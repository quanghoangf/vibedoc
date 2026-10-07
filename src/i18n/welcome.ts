// UI text for the first-run welcome (R082, src/app/(app)/start). Conventions: see src/i18n/shell.ts.
import type { Messages } from "../lib/i18n"

export const en = {
  title: "Welcome to VibeDoc",
  loading: "Reading your project…",
  docsLead: "This project has docs but no roadmap yet. Your agent can read them and draft the roadmap.",
  docsStart: "Generate roadmap from your docs",
  emptyLead: "This project is empty. Tell your agent what you want to build and it plans the first epics with you.",
  emptyStart: "Plan the first epics with the agent",
  skip: "Go to the board",
}

export const vi: Messages<typeof en> = {
  title: "Chào mừng đến với VibeDoc",
  loading: "Đang đọc dự án của bạn…",
  docsLead: "Dự án này đã có tài liệu nhưng chưa có lộ trình. Agent có thể đọc chúng và soạn lộ trình.",
  docsStart: "Tạo lộ trình từ tài liệu của bạn",
  emptyLead: "Dự án này còn trống. Hãy nói với agent bạn muốn làm gì, agent sẽ cùng bạn lập các epic đầu tiên.",
  emptyStart: "Lập các epic đầu tiên cùng agent",
  skip: "Tới bảng việc",
}
