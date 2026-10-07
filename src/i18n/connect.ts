// UI text for the Connect your agent panel (R081): Settings → Connect agent, and the welcome screen (R082).
// Conventions: see src/i18n/shell.ts.
import type { Messages } from "../lib/i18n"

export const en = {
  title: "Connect your agent",
  hint: "Connect a coding agent to this project. A step turns ✓ only when VibeDoc sees it working.",
  tab: "Connect agent",
  stepMcp: "MCP server",
  stepMcpHint: "Gives the agent VibeDoc's tools for this project: tasks, docs, roadmap and memory.",
  mcpUrl: "MCP URL",
  runInProject: "Run this in the project folder:",
  copy: "Copy",
  copied: "Copied",
  waiting: "Waiting for the first call. Start {agent} in this project and ask it to call vibedoc_get_status.",
  connected: "Connected · {agent} · last call {ago}",
  someAgent: "an agent",
  done: "Done",
  notDone: "Not done yet",
  loadFailed: "Couldn’t read the connection status.",
  advanced: "Advanced",
} as const

export const vi: Messages<typeof en> = {
  title: "Kết nối agent của bạn",
  hint: "Kết nối một coding agent với dự án này. Một bước chỉ chuyển ✓ khi VibeDoc thấy nó hoạt động.",
  tab: "Kết nối agent",
  stepMcp: "Máy chủ MCP",
  stepMcpHint: "Cho agent dùng các công cụ của VibeDoc trong dự án này: task, tài liệu, lộ trình và bộ nhớ.",
  mcpUrl: "URL MCP",
  runInProject: "Chạy lệnh này trong thư mục dự án:",
  copy: "Sao chép",
  copied: "Đã sao chép",
  waiting: "Đang chờ lệnh gọi đầu tiên. Mở {agent} trong dự án này và yêu cầu nó gọi vibedoc_get_status.",
  connected: "Đã kết nối · {agent} · lần gọi gần nhất {ago}",
  someAgent: "một agent",
  done: "Xong",
  notDone: "Chưa xong",
  loadFailed: "Không đọc được trạng thái kết nối.",
  advanced: "Nâng cao",
}
