// UI text that shows only inside the desktop app (R112): the update banner and its What's new dialog.
// Conventions: see src/i18n/shell.ts.
import type { Messages } from "../lib/i18n"

export const en = {
  updateLabel: "VibeDoc update",
  updateAvailable: "VibeDoc {version} is available",
  whatsNew: "What's new",
  later: "Later",
  notesTitle: "What's new in VibeDoc {version}",
  noNotes: "This release has no notes.",
  released: "Released {date}",
  close: "Close",
  update: "Update",
  downloading: "Downloading VibeDoc {version}… {percent}%",
  ready: "VibeDoc {version} is ready",
  restart: "Restart to update",
  confirmRestart: "An agent is still working in a chat. Restart VibeDoc to update anyway? The chat stops and can be resumed later.",
  failed: "VibeDoc {version} couldn’t be installed from here",
  downloadPage: "Download the new version",
  tryAgain: "Try again",
} as const

export const vi: Messages<typeof en> = {
  updateLabel: "Bản cập nhật VibeDoc",
  updateAvailable: "Đã có VibeDoc {version}",
  whatsNew: "Có gì mới",
  later: "Để sau",
  notesTitle: "Có gì mới trong VibeDoc {version}",
  noNotes: "Bản phát hành này không có ghi chú.",
  released: "Phát hành {date}",
  close: "Đóng",
  update: "Cập nhật",
  downloading: "Đang tải VibeDoc {version}… {percent}%",
  ready: "VibeDoc {version} đã sẵn sàng",
  restart: "Khởi động lại để cập nhật",
  confirmRestart: "Một agent vẫn đang làm việc trong một chat. Vẫn khởi động lại VibeDoc để cập nhật? Chat sẽ dừng và có thể tiếp tục sau.",
  failed: "Không cài được VibeDoc {version} từ đây",
  downloadPage: "Tải bản mới",
  tryAgain: "Thử lại",
}
