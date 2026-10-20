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
}
