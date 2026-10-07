// UI text for first-run feedback (R086): the consent card, Settings → Privacy and the "Stuck? Tell us" link.
// Conventions: see src/i18n/shell.ts.
import type { Messages } from "../lib/i18n"

export const en = {
  cardLabel: "First-run feedback",
  title: "Help improve VibeDoc?",
  lead: "Send an anonymous note when you reach each first-run step, so the setup step that loses people gets fixed first. Off unless you say yes.",
  whatSent: "What would be sent, once per step, from this browser:",
  stepStarted: "You opened VibeDoc",
  stepAgent: "An agent connected",
  stepRoadmap: "The first epic is on the roadmap",
  stepTask: "The first task is done",
  neverSent: "Never sent: project names, file paths, file contents, task or doc text. No IDs, no cookies.",
  changeLater: "You can change this any time in Settings → Privacy.",
  yes: "Yes, send these",
  no: "No thanks",
  showDetails: "What exactly is sent?",
} as const

export const vi: Messages<typeof en> = {
  cardLabel: "Phản hồi lần chạy đầu",
  title: "Giúp cải thiện VibeDoc?",
  lead: "Gửi một ghi nhận ẩn danh khi bạn đến mỗi bước của lần chạy đầu, để bước cài đặt làm người dùng bỏ cuộc được sửa trước. Chỉ bật khi bạn đồng ý.",
  whatSent: "Những gì sẽ được gửi, mỗi bước một lần, từ trình duyệt này:",
  stepStarted: "Bạn đã mở VibeDoc",
  stepAgent: "Một agent đã kết nối",
  stepRoadmap: "Epic đầu tiên đã có trên lộ trình",
  stepTask: "Công việc đầu tiên đã xong",
  neverSent: "Không bao giờ gửi: tên dự án, đường dẫn tệp, nội dung tệp, nội dung công việc hay tài liệu. Không mã định danh, không cookie.",
  changeLater: "Bạn có thể đổi lựa chọn này bất cứ lúc nào trong Cài đặt → Quyền riêng tư.",
  yes: "Có, gửi những thứ này",
  no: "Không, cảm ơn",
  showDetails: "Chính xác thì gửi những gì?",
}
