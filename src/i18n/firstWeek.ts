// UI text for the first-week checklist in the sidebar (R084). Conventions: see src/i18n/shell.ts.
import type { Messages } from "../lib/i18n"

export const en = {
  title: "First week",
  progress: "{done}/{total}",
  progressLabel: "{done} of {total} steps done",
  stepDone: "done",
  stepTodo: "not done yet",
  agent: "Agent connected",
  roadmap: "Roadmap created",
  breakdown: "First epic broken down",
  taskDone: "First task done by the agent",
  testRun: "First test run with evidence",
  memory: "First memory entry",
} as const

export const vi: Messages<typeof en> = {
  title: "Tuần đầu tiên",
  progress: "{done}/{total}",
  progressLabel: "Đã xong {done}/{total} bước",
  stepDone: "đã xong",
  stepTodo: "chưa xong",
  agent: "Đã kết nối agent",
  roadmap: "Đã tạo lộ trình",
  breakdown: "Đã chia nhỏ epic đầu tiên",
  taskDone: "Agent đã xong task đầu tiên",
  testRun: "Lần chạy test đầu tiên có bằng chứng",
  memory: "Mục ghi nhớ đầu tiên",
}
